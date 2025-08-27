from fastapi import FastAPI, HTTPException, BackgroundTasks, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import time
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from .download_extract import AudioProcessor
from .task_manager import task_manager, TaskStatus
from .ffmpeg_utils import ensure_ffmpeg
from .cache import cache
import logging

logger = logging.getLogger(__name__)

def validate_clip_ids(clip_ids: List[str]) -> None:
    """
    Validate a list of clip IDs against the conservative regex pattern.
    
    Args:
        clip_ids: List of clip IDs to validate
        
    Raises:
        HTTPException: If any clip ID fails validation with status_code=400
    """
    if not clip_ids:
        raise HTTPException(status_code=400, detail="No clip IDs provided")
    
    if len(clip_ids) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 clips per request")
    
    # Conservative regex pattern: alphanumeric characters, hyphens, and underscores only
    CLIP_ID_PATTERN = r'^[A-Za-z0-9_-]+$'
    
    invalid_ids = []
    for clip_id in clip_ids:
        if not isinstance(clip_id, str):
            invalid_ids.append(f"{clip_id} (not a string)")
        elif not clip_id.strip():
            invalid_ids.append(f"{clip_id} (empty or whitespace only)")
        elif not re.match(CLIP_ID_PATTERN, clip_id.strip()):
            invalid_ids.append(f"{clip_id} (contains invalid characters)")
    
    if invalid_ids:
        raise HTTPException(
            status_code=400, 
            detail=f"Invalid clip ID(s): {', '.join(invalid_ids)}. Clip IDs must contain only alphanumeric characters, hyphens, and underscores."
        )

app = FastAPI(
    title="Audio Processor API",
    description="Service for downloading and processing Twitch clips",
    version="1.0.0"
)

# Initialize audio processor
processor = AudioProcessor()

class ProcessClipRequest(BaseModel):
    clip_ids: List[str]
    background: bool = False

class ProcessClipResponse(BaseModel):
    success: bool
    message: str
    results: Optional[dict] = None
    task_id: Optional[str] = None

class HealthResponse(BaseModel):
    status: str
    ffmpeg_available: bool
    r2_configured: bool
    cache_healthy: bool
    cache_type: str

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    clip_ids: List[str]
    created_at: str
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    results: Optional[dict] = None
    error: Optional[str] = None

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    
    ffmpeg_available = ensure_ffmpeg()
    r2_configured = all([
        os.getenv('CLOUDFLARE_ACCOUNT_ID'),
        os.getenv('CLOUDFLARE_ZONE_ID'),
        os.getenv('CLOUDFLARE_API_TOKEN'),
        os.getenv('R2_BUCKET')
    ])
    
    # Check cache health
    cache_healthy = cache.health_check()
    cache_type = type(cache).__name__
    
    # Overall health depends on all critical services
    overall_healthy = ffmpeg_available and r2_configured and cache_healthy
    
    return HealthResponse(
        status="healthy" if overall_healthy else "unhealthy",
        ffmpeg_available=ffmpeg_available,
        r2_configured=r2_configured,
        cache_healthy=cache_healthy,
        cache_type=cache_type
    )

@app.post("/process-clips", response_model=ProcessClipResponse)
async def process_clips(request: ProcessClipRequest, background_tasks: BackgroundTasks):
    """Process Twitch clips: download, extract audio, upload to R2"""
    
    # Validate clip IDs at the API boundary
    validate_clip_ids(request.clip_ids)
    
    if request.background:
        # Create task record and get task_id
        task_id = task_manager.create_task(request.clip_ids)
        
        # Schedule background task with task_id
        background_tasks.add_task(processor.process_clips, request.clip_ids, task_id)
        
        return ProcessClipResponse(
            success=True,
            message=f"Processing {len(request.clip_ids)} clips in background",
            task_id=task_id
        )
    else:
        # Process synchronously
        try:
            results = processor.process_clips(request.clip_ids)
            
            return ProcessClipResponse(
                success=results["failed"] == 0,
                message=f"Processed {results['successful']}/{results['total']} clips successfully",
                results=results
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.get("/clip-status/{clip_id}")
async def get_clip_status(clip_id: str):
    """Check processing status of a specific clip"""
    
    # Define file paths to check
    file_paths = [
        f"audio/{clip_id}.wav",
        f"clips/{clip_id}.mp4", 
        f"transcripts/{clip_id}.json"
    ]
    
    # Run file existence checks in parallel with error handling
    file_exists_results = {}
    
    try:
        with ThreadPoolExecutor(max_workers=3) as executor:
            # Submit all file existence checks
            future_to_path = {
                executor.submit(processor.r2.file_exists, path): path 
                for path in file_paths
            }
            
            # Collect results as they complete
            for future in as_completed(future_to_path):
                path = future_to_path[future]
                try:
                    exists = future.result()
                    file_exists_results[path] = exists
                except Exception as e:
                    logger.error(f"Error checking file existence for {path}: {e}")
                    # Treat as not found on error
                    file_exists_results[path] = False
                    
    except Exception as e:
        logger.error(f"Failed to check file existence for clip {clip_id}: {e}")
        # Return 503 Service Unavailable for R2/network failures
        raise HTTPException(
            status_code=503, 
            detail="Storage service temporarily unavailable"
        )
    
    # Extract results
    audio_exists = file_exists_results.get(f"audio/{clip_id}.wav", False)
    mp4_exists = file_exists_results.get(f"clips/{clip_id}.mp4", False)
    transcript_exists = file_exists_results.get(f"transcripts/{clip_id}.json", False)
    
    return {
        "clip_id": clip_id,
        "audio_processed": audio_exists,
        "video_stored": mp4_exists,
        "transcript_ready": transcript_exists,
        "ready_for_transcription": audio_exists and not transcript_exists
    }

@app.get("/list-processed-clips")
async def list_processed_clips(limit: int = 50, cursor: Optional[str] = None):
    """List clips that have been processed with pagination support"""
    
    try:
        # List audio files (processed clips) with pagination
        result = processor.r2.list_files("audio/", limit=limit, cursor=cursor)
        audio_files = result['objects']
        
        # Extract clip IDs from file paths - only accept top-level WAVs under audio/
        clip_ids = []
        for file_path in audio_files:
            # Only accept files that match pattern: audio/filename.wav (no extra slashes)
            if file_path.startswith('audio/') and file_path.count('/') == 1 and file_path.endswith('.wav'):
                clip_id = file_path.replace('audio/', '').replace('.wav', '')
                clip_ids.append(clip_id)
        
        return {
            "total_processed": len(clip_ids),
            "clips": clip_ids,
            "cursor": result['cursor'],
            "has_more": result['truncated']
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list clips: {str(e)}")

@app.delete("/cleanup/{clip_id}")
async def cleanup_clip(
    clip_id: str, 
    dry_run: bool = True, 
    confirm: bool = False
):
    """Remove all files for a specific clip (for testing/cleanup)"""
    
    # Require confirmation for actual deletion
    if not dry_run and not confirm:
        raise HTTPException(
            status_code=400, 
            detail="Actual deletion requires confirm=true parameter. Use dry_run=true for preview."
        )
    
    try:
        # List all files for this clip
        files_to_delete = []
        
        # Check for various file types
        file_patterns = [
            f"clips/{clip_id}.mp4",
            f"audio/{clip_id}.wav",
            f"transcripts/{clip_id}.json",
            f"transcripts/{clip_id}.txt",
            f"transcripts/{clip_id}.vtt",
            f"transcripts/{clip_id}.ok"
        ]
        
        # Check file existence in parallel with error handling
        try:
            with ThreadPoolExecutor(max_workers=6) as executor:
                # Submit all file existence checks
                future_to_pattern = {
                    executor.submit(processor.r2.file_exists, pattern): pattern 
                    for pattern in file_patterns
                }
                
                # Collect results as they complete
                for future in as_completed(future_to_pattern):
                    pattern = future_to_pattern[future]
                    try:
                        exists = future.result()
                        if exists:
                            files_to_delete.append(pattern)
                    except Exception as e:
                        logger.error(f"Error checking file existence for {pattern}: {e}")
                        # Skip this file on error - don't add to deletion list
                        
        except Exception as e:
            logger.error(f"Failed to check file existence for cleanup of clip {clip_id}: {e}")
            # Continue with cleanup even if some checks fail
            # Files that couldn't be checked will be skipped
        
        # Also check for chunked audio files
        chunk_prefix = f"audio/{clip_id}/"
        # Use a reasonable limit to prevent memory issues with large numbers of chunks
        chunk_result = processor.r2.list_files(chunk_prefix, limit=1000, cursor=None)
        chunk_files = chunk_result['objects']
        files_to_delete.extend(chunk_files)
        
        if not files_to_delete:
            return {
                "clip_id": clip_id,
                "dry_run": dry_run,
                "message": "No files found for this clip",
                "files_to_delete": [],
                "deleted_files": [],
                "failed_deletions": []
            }
        
        if dry_run:
            # Return preview of what would be deleted
            return {
                "clip_id": clip_id,
                "dry_run": True,
                "message": "Dry run - no files were actually deleted",
                "files_to_delete": files_to_delete,
                "deleted_files": [],
                "failed_deletions": []
            }
        
        # Perform actual deletion
        deleted_files = []
        failed_deletions = []
        
        for file_path in files_to_delete:
            try:
                if processor.r2.delete(file_path):
                    deleted_files.append(file_path)
                    logger.info(f"Successfully deleted file: {file_path}")
                else:
                    failed_deletions.append({
                        "file": file_path,
                        "error": "Delete operation returned False"
                    })
                    logger.error(f"Failed to delete file: {file_path}")
            except Exception as e:
                failed_deletions.append({
                    "file": file_path,
                    "error": str(e)
                })
                logger.error(f"Exception while deleting file {file_path}: {e}")
        
        # Determine response status
        if failed_deletions:
            status_code = 207  # Multi-Status
            message = f"Partial cleanup completed. {len(deleted_files)} files deleted, {len(failed_deletions)} failed."
        else:
            status_code = 200
            message = f"Successfully deleted {len(deleted_files)} files for clip {clip_id}"
        
        response_data = {
            "clip_id": clip_id,
            "dry_run": False,
            "message": message,
            "files_to_delete": files_to_delete,
            "deleted_files": deleted_files,
            "failed_deletions": failed_deletions,
            "summary": {
                "total_files": len(files_to_delete),
                "successfully_deleted": len(deleted_files),
                "failed_deletions": len(failed_deletions)
            }
        }
        
        # Return appropriate status code
        if status_code == 207:
            return JSONResponse(
                status_code=status_code,
                content=response_data
            )
        else:
            return response_data
        
    except Exception as e:
        logger.error(f"Cleanup failed for clip {clip_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Cleanup failed: {str(e)}")

@app.get("/task/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """Get the status of a background task"""
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return TaskStatusResponse(**task.to_dict())

@app.get("/tasks")
async def list_tasks(limit: int = 50):
    """List recent tasks with their status"""
    tasks = task_manager.list_tasks(limit)
    return {
        "tasks": tasks,
        "total": len(tasks)
    }

@app.delete("/task/{task_id}")
async def delete_task(task_id: str):
    """Delete a task record (for cleanup)"""
    task = task_manager.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Remove from task manager using the public API
    if not task_manager.delete_task(task_id):
        raise HTTPException(status_code=500, detail="Failed to delete task")
    
    return {"message": f"Task {task_id} deleted"}

@app.post("/tasks/cleanup")
async def cleanup_old_tasks(max_age_hours: int = 24):
    """Clean up old completed/failed tasks"""
    cleaned_count = task_manager.cleanup_old_tasks(max_age_hours)
    return {
        "message": f"Cleaned up {cleaned_count} old tasks",
        "cleaned_count": cleaned_count
    }

@app.get("/tasks/stats")
async def get_task_stats():
    """Get statistics about tasks"""
    return task_manager.get_task_stats()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
