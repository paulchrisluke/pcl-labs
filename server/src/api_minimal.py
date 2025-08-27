from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import os
import time
import logging

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Audio Processor API (Minimal)",
    description="Minimal service for testing",
    version="1.0.0"
)

class ProcessClipRequest(BaseModel):
    clip_ids: List[str]
    background: bool = False

class ProcessClipResponse(BaseModel):
    success: bool
    message: str
    results: Optional[dict] = None
    task_id: Optional[str] = None

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "ffmpeg_available": False,
        "r2_configured": False,
        "cache_healthy": False,
        "cache_type": "none",
        "timestamp": time.time()
    }

@app.post("/process-clips", response_model=ProcessClipResponse)
async def process_clips(request: ProcessClipRequest):
    """Mock process clips endpoint for testing"""
    
    if not request.clip_ids:
        raise HTTPException(status_code=400, detail="No clip IDs provided")
    
    if len(request.clip_ids) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 clips per request")
    
    # Mock processing
    results = {
        "total": len(request.clip_ids),
        "successful": len(request.clip_ids),
        "failed": 0,
        "clips": {}
    }
    
    for clip_id in request.clip_ids:
        results["clips"][clip_id] = {
            "status": "success",
            "message": "Mock processing completed"
        }
    
    return ProcessClipResponse(
        success=True,
        message=f"Mock processed {len(request.clip_ids)} clips",
        results=results
    )

@app.get("/clip-status/{clip_id}")
async def get_clip_status(clip_id: str):
    """Mock clip status endpoint"""
    return {
        "clip_id": clip_id,
        "audio_processed": True,
        "video_stored": True,
        "transcript_ready": False,
        "ready_for_transcription": True
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
