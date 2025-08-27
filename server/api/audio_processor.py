from http.server import BaseHTTPRequestHandler
import json
import os
import tempfile
import time
import logging
import requests
import re
from pathlib import Path
from yt_dlp import YoutubeDL
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from src.storage.r2 import R2Storage
from src.security import security_middleware
from src.ffmpeg_utils import ensure_ffmpeg, mp4_to_wav16k, get_audio_duration, chunk_audio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def validate_clip_id(clip_id: str) -> str:
    """
    Validate and sanitize clip_id to prevent injection attacks.
    
    Args:
        clip_id: The clip ID to validate
        
    Returns:
        The validated clip_id
        
    Raises:
        ValueError: If clip_id doesn't match the allowed pattern
    """
    if not isinstance(clip_id, str):
        raise ValueError("clip_id must be a string")
    
    # Trim whitespace first
    trimmed_clip_id = clip_id.strip()
    
    if not trimmed_clip_id:
        raise ValueError("clip_id cannot be empty or whitespace only")
    
    # Allow alphanumeric characters, hyphens, and underscores
    # Limit length to prevent abuse (reasonable limit for Twitch clip IDs)
    CLIP_ID_PATTERN = r'^[a-zA-Z0-9_-]{1,50}$'
    
    if not re.match(CLIP_ID_PATTERN, trimmed_clip_id):
        raise ValueError(
            f"Invalid clip_id format: '{clip_id}'. "
            "Clip ID must contain only alphanumeric characters, hyphens, and underscores, "
            "and be between 1-50 characters long."
        )
    
    return trimmed_clip_id



class handler(BaseHTTPRequestHandler):
    def validate_request(self, method: str, body: str = '') -> tuple[bool, str]:
        """
        Validate request using security middleware.
        Returns: (is_valid, error_message)
        """
        # Get headers as dictionary
        headers = dict(self.headers.items())
        
        # Debug logging
        # Debug logging (use debug level to avoid exposing sensitive data in production)
        logger.debug(f"Received headers count: {len(headers)}")
        logger.debug(f"Required headers check:")
        logger.debug(f"  X-Request-Signature: {'PRESENT' if headers.get('X-Request-Signature') or headers.get('x-request-signature') else 'MISSING'}")
        logger.debug(f"  X-Request-Timestamp: {'PRESENT' if headers.get('X-Request-Timestamp') or headers.get('x-request-timestamp') else 'MISSING'}")
        logger.debug(f"  X-Request-Nonce: {'PRESENT' if headers.get('X-Request-Nonce') or headers.get('x-request-nonce') else 'MISSING'}")
        
        # Validate request
        is_valid, error_message = security_middleware.validate_request(
            method=method,
            path=self.path,
            headers=headers,
            body=body
        )
        
        return is_valid, error_message
    
    def do_GET(self):
        # Validate request security
        is_valid, error_message = self.validate_request('GET')
        if not is_valid:
            # Return appropriate status code based on error type
            if "Rate limit exceeded" in error_message:
                self.send_error_response(429, f"Security validation failed: {error_message}")
            else:
                self.send_error_response(401, f"Security validation failed: {error_message}")
            return
        
        # Parse the path to determine the endpoint
        path = self.path.rstrip('/')
        
        # Accept both underscore and hyphenated base path variants
        if path in ['/api/audio_processor/latest', '/api/audio-processor/latest']:
            # Get latest clip endpoint
            self.handle_get_latest_clip()
        elif path in ['/api/audio_processor/clips', '/api/audio-processor/clips']:
            # List all clips endpoint
            self.handle_list_clips()
        else:
            # Default health check endpoint
            self.handle_health_check()
    
    def handle_health_check(self):
        """Handle the default health check endpoint"""
        r2_storage = R2Storage()
        r2_configured = r2_storage.enabled
        ffmpeg_available = ensure_ffmpeg()
        
        response_data = {
            "status": "healthy",
            "service": "Audio Processor",
            "version": "1.0.0",
            "message": "Audio processor is running",
            "r2_configured": r2_configured,
            "ffmpeg_available": ffmpeg_available,
            "note": "R2 upload requires API token with R2 Storage:Edit permissions" if not r2_configured else "R2 storage is configured and ready"
        }
        
        self.send_success_response(response_data)
    
    def handle_get_latest_clip(self):
        """Handle getting the latest clip from R2 storage"""
        r2_storage = R2Storage()
        
        if not r2_storage.enabled:
            self.send_error_response(503, "R2 storage not configured - Cannot retrieve latest clip")
            return
        
        latest_clip = r2_storage.get_latest_clip()
        
        if latest_clip:
            response_data = {
                "success": True,
                "latest_clip": latest_clip,
                "message": f"Found latest clip: {latest_clip['clip_id']}"
            }
            self.send_success_response(response_data)
        else:
            self.send_error_response(404, "No clips found in R2 storage")
    
    def handle_list_clips(self):
        """Handle listing all clips from R2 storage"""
        r2_storage = R2Storage()
        
        if not r2_storage.enabled:
            self.send_error_response(503, "R2 storage not configured - Cannot list clips")
            return
        
        clips = r2_storage.list_objects(prefix="clips/", limit=100)
        
        response_data = {
            "success": True,
            "total_clips": len(clips),
            "clips": clips,
            "message": f"Found {len(clips)} clips in R2 storage"
        }
        
        self.send_success_response(response_data)
    
    def _validate_content_length(self) -> int:
        """Safely validate and parse Content-Length header"""
        content_length_str = self.headers.get('Content-Length')
        
        # Check if header is present
        if not content_length_str:
            self.send_error_response(411, 'Content-Length header is required')
            return None
            
        # Check if it's a non-empty string
        if not isinstance(content_length_str, str) or not content_length_str.strip():
            self.send_error_response(400, 'Content-Length header must be a non-empty string')
            return None
            
        # Check if it contains only digits
        if not content_length_str.strip().isdigit():
            self.send_error_response(400, 'Content-Length header must contain only digits')
            return None
            
        try:
            content_length = int(content_length_str)
        except ValueError:
            self.send_error_response(400, 'Content-Length header could not be parsed as integer')
            return None
            
        # Check for negative values
        if content_length < 0:
            self.send_error_response(400, 'Content-Length cannot be negative')
            return None
            
        # Check for unreasonably large values (e.g., > 100MB)
        MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB
        if content_length > MAX_CONTENT_LENGTH:
            self.send_error_response(413, f'Content-Length too large (max {MAX_CONTENT_LENGTH} bytes)')
            return None
            
        return content_length

    def do_POST(self):
        # Normalize and accept common variants
        path = self.path.rstrip('/')
        allowed = {
            '/process_clips',
            '/process-clips',
            '/api/audio_processor/process_clips',
            '/api/audio_processor/process-clips',
            '/api/audio-processor/process_clips',
            '/api/audio-processor/process-clips',
        }
        if path not in allowed:
            self.send_error_response(404, f'Unknown endpoint: {path}')
            return
            
        try:
            # Safely validate and read request body
            content_length = self._validate_content_length()
            if content_length is None:
                return  # Error response already sent
                
            body = self.rfile.read(content_length)
            body_str = body.decode('utf-8')
            
            # Validate request security
            is_valid, error_message = self.validate_request('POST', body_str)
            if not is_valid:
                # Return appropriate status code based on error type
                if "Rate limit exceeded" in error_message:
                    self.send_error_response(429, f"Security validation failed: {error_message}")
                else:
                    self.send_error_response(401, f"Security validation failed: {error_message}")
                return
            
            try:
                data = json.loads(body.decode('utf-8'))
            except json.JSONDecodeError as e:
                self.send_error_response(400, 'Invalid JSON')
                return
            
            clip_ids = data.get('clip_ids', [])
            
            if not clip_ids or not isinstance(clip_ids, list):
                self.send_error_response(400, 'clip_ids array is required')
                return
                
            if len(clip_ids) > 10:
                self.send_error_response(400, 'Maximum 10 clips per request')
                return
            
            logger.info(f"Processing {len(clip_ids)} clips...")
            
            # Process clips
            results = self.process_clips(clip_ids)
            
            # Send response
            self.send_success_response({
                "success": results["failed"] == 0,
                "message": f"Processed {results['successful']}/{results['total']} clips successfully",
                "results": results
            })
            
        except Exception as e:
            logger.error(f"Error processing clips: {e}")
            self.send_error_response(500, str(e))
    
    def do_OPTIONS(self):
        # Return 405 Method Not Allowed for OPTIONS requests
        self.send_error_response(405, "Method not allowed")
    
    def send_success_response(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def send_error_response(self, status_code, message):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({
            "success": False,
            "error": message
        }).encode('utf-8'))

    def get_clip_info(self, clip_id: str) -> dict:
        """Get basic info about a clip (duration, size, etc.)"""
        # Validate clip_id before using it
        validated_clip_id = validate_clip_id(clip_id)
        
        return {
            "clip_id": validated_clip_id,
            "source": "twitch",
            "processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }

    def twitch_clip_url(self, clip_id: str) -> str:
        """Generate Twitch clip URL for yt-dlp"""
        # Validate clip_id before using it in URL
        validated_clip_id = validate_clip_id(clip_id)
        return f"https://clips.twitch.tv/{validated_clip_id}"

    def download_clip_video(self, clip_id: str, out_dir: Path) -> Path:
        """Download Twitch clip using yt-dlp and return the actual downloaded file"""
        # Validate clip_id before using it
        validated_clip_id = validate_clip_id(clip_id)
        
        out_dir.mkdir(parents=True, exist_ok=True)
        out_tmpl = str(out_dir / f"{validated_clip_id}.%(ext)s")
        
        # Configure yt-dlp options with secure SSL certificate verification
        # Allow disabling SSL checks only via environment variable for compatibility issues
        disable_ssl = os.getenv('DISABLE_SSL_CERTIFICATE_CHECK', 'false').lower() == 'true'
        
        ydl_opts = {
            "outtmpl": out_tmpl,
            "format": "mp4/best",
            "quiet": True,
            "no_warnings": True,
        }
        
        # Only disable SSL certificate verification if explicitly requested via environment variable
        # This should only be used in development/testing environments with legitimate compatibility issues
        if disable_ssl:
            logger.warning("SSL certificate verification disabled via DISABLE_SSL_CERTIFICATE_CHECK environment variable")
            logger.warning("SECURITY WARNING: This makes the application vulnerable to man-in-the-middle attacks")
            ydl_opts["nocheckcertificate"] = True
        else:
            # Default behavior: enable SSL certificate verification for security
            logger.info("SSL certificate verification enabled (default secure behavior)")
        
        with YoutubeDL(ydl_opts) as ydl:
            ydl.download([self.twitch_clip_url(validated_clip_id)])
        
        # Find the downloaded file - accept whatever format yt-dlp actually downloaded
        downloaded_file = None
        for p in out_dir.glob(f"{validated_clip_id}.*"):
            if p.suffix in ['.mp4', '.mkv', '.webm']:
                downloaded_file = p
                break
        
        if not downloaded_file or not downloaded_file.exists():
            raise FileNotFoundError(f"Failed to download clip {validated_clip_id} - no valid video file found")
        
        return downloaded_file

    def process_clip(self, clip_id: str) -> dict:
        """Process a single clip: download, upload to R2, and return info"""
        # Validate clip_id before using it
        validated_clip_id = validate_clip_id(clip_id)
        
        result = {
            "clip_id": validated_clip_id,
            "success": False,
            "error": None,
            "clip_info": None,
            "note": "MP4 downloaded and uploaded to R2 storage",
            "partial_success": False
        }
        
        # Initialize R2 storage
        r2_storage = R2Storage()
        
        try:
            # Create temporary directory
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir)
                
                # Download video file
                logger.info(f"Downloading clip {validated_clip_id}...")
                video_path = self.download_clip_video(validated_clip_id, tmp_path)
                
                if not video_path.exists() or video_path.stat().st_size == 0:
                    result["error"] = "Failed to download video file"
                    logger.error(f"Clip {validated_clip_id}: Video file download failed - file doesn't exist or is empty")
                    return result
                
                # Upload to R2 storage
                logger.info(f"Uploading clip {validated_clip_id} to R2...")
                file_extension = video_path.suffix
                r2_key = f"clips/{validated_clip_id}{file_extension}"
                
                # Determine content type based on file extension
                content_type_map = {
                    '.mp4': 'video/mp4',
                    '.mkv': 'video/x-matroska',
                    '.webm': 'video/webm'
                }
                content_type = content_type_map.get(file_extension, 'video/mp4')
                
                metadata = {
                    "clip_id": validated_clip_id,
                    "source": "twitch",
                    "processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "file_size": str(video_path.stat().st_size),
                    "original_format": file_extension[1:]  # Remove the dot
                }
                
                video_upload_success = r2_storage.put_file(r2_key, str(video_path), content_type, metadata)
                if not video_upload_success:
                    result["error"] = "Failed to upload video file to R2 storage"
                    logger.error(f"Clip {validated_clip_id}: Video upload to R2 failed")
                    return result
                
                logger.info(f"Clip {validated_clip_id}: Video uploaded successfully to R2")
                
                # Extract audio from video
                logger.info(f"Extracting audio from {validated_clip_id}...")
                audio_path = tmp_path / f"{validated_clip_id}.wav"
                
                # Check if FFmpeg is available
                if not ensure_ffmpeg():
                    result["error"] = "FFmpeg not available for audio extraction"
                    logger.error(f"Clip {validated_clip_id}: FFmpeg not available for audio extraction")
                    # Rollback: Delete the uploaded video file since audio extraction failed
                    if r2_storage.delete_file(r2_key):
                        logger.info(f"Clip {validated_clip_id}: Rolled back video upload due to FFmpeg unavailability")
                    else:
                        logger.error(f"Clip {validated_clip_id}: Failed to rollback video upload - manual cleanup may be needed")
                    return result
                
                # Extract audio to WAV format (16kHz, mono)
                audio_extraction_success = mp4_to_wav16k(video_path, audio_path, sample_rate=16000, channels=1)
                if not audio_extraction_success:
                    result["error"] = "Failed to extract audio from video"
                    logger.error(f"Clip {validated_clip_id}: Audio extraction failed - FFmpeg command failed or output file is invalid")
                    # Rollback: Delete the uploaded video file since audio extraction failed
                    if r2_storage.delete_file(r2_key):
                        logger.info(f"Clip {validated_clip_id}: Rolled back video upload due to audio extraction failure")
                    else:
                        logger.error(f"Clip {validated_clip_id}: Failed to rollback video upload - manual cleanup may be needed")
                    return result
                
                # Verify audio file was created and has content
                if not audio_path.exists() or audio_path.stat().st_size == 0:
                    result["error"] = "Audio extraction failed - no audio file generated"
                    logger.error(f"Clip {validated_clip_id}: Audio extraction failed - audio file doesn't exist or is empty")
                    # Rollback: Delete the uploaded video file since audio extraction failed
                    if r2_storage.delete_file(r2_key):
                        logger.info(f"Clip {validated_clip_id}: Rolled back video upload due to audio extraction failure")
                    else:
                        logger.error(f"Clip {validated_clip_id}: Failed to rollback video upload - manual cleanup may be needed")
                    return result
                
                logger.info(f"Clip {validated_clip_id}: Audio extraction successful")
                
                # Get audio duration
                duration = None
                try:
                    duration = get_audio_duration(audio_path)
                    logger.info(f"Clip {validated_clip_id}: Audio duration determined: {duration} seconds")
                except Exception as e:
                    logger.warning(f"Clip {validated_clip_id}: Could not determine audio duration: {e}")
                
                # Upload audio to R2
                logger.info(f"Uploading audio for {validated_clip_id} to R2...")
                audio_key = f"audio/{validated_clip_id}.wav"
                audio_metadata = {
                    "clip_id": validated_clip_id,
                    "source": "twitch",
                    "processed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "file_size": str(audio_path.stat().st_size),
                    "audio_format": "wav",
                    "sample_rate": "16000",
                    "channels": "1",
                    "duration": str(duration) if duration else "unknown"
                }
                
                audio_upload_success = r2_storage.put_file(audio_key, str(audio_path), "audio/wav", audio_metadata)
                if not audio_upload_success:
                    result["error"] = "Failed to upload audio file to R2 storage"
                    result["partial_success"] = True
                    result["note"] = "Video uploaded successfully but audio upload failed - video file remains in R2"
                    logger.error(f"Clip {validated_clip_id}: Audio upload to R2 failed - video file remains in R2 storage")
                    # Note: We don't rollback here as the user might want to keep the video even without audio
                    # The partial_success flag indicates this state
                    
                    # Return partial success info
                    clip_info = self.get_clip_info(validated_clip_id)
                    clip_info["file_size"] = video_path.stat().st_size
                    clip_info["file_path"] = r2_storage.get_file_url(r2_key)
                    clip_info["r2_key"] = r2_key
                    clip_info["file_format"] = file_extension[1:]  # Remove the dot
                    clip_info["audio_upload_failed"] = True
                    
                    result["clip_info"] = clip_info
                    return result
                
                logger.info(f"Clip {validated_clip_id}: Audio uploaded successfully to R2")
                
                # Full success - both video and audio uploaded
                clip_info = self.get_clip_info(validated_clip_id)
                clip_info["file_size"] = video_path.stat().st_size
                clip_info["file_path"] = r2_storage.get_file_url(r2_key)
                clip_info["r2_key"] = r2_key
                clip_info["file_format"] = file_extension[1:]  # Remove the dot
                clip_info["audio_file_size"] = audio_path.stat().st_size
                clip_info["audio_file_path"] = r2_storage.get_file_url(audio_key)
                clip_info["audio_r2_key"] = audio_key
                clip_info["audio_duration"] = duration
                
                result["success"] = True
                result["clip_info"] = clip_info
                result["note"] = f"Video and audio files processed and uploaded to R2 successfully"
                logger.info(f"Clip {validated_clip_id}: Successfully processed - video and audio uploaded to R2")
                
                return result
                
        except Exception as e:
            result["error"] = str(e)
            logger.error(f"Clip {validated_clip_id}: Unexpected error during processing: {e}")
            return result

    def process_clips(self, clip_ids: list) -> dict:
        """Process multiple clips"""
        if not isinstance(clip_ids, list):
            return {
                "total": 0,
                "successful": 0,
                "failed": 1,
                "results": [{"clip_id": None, "success": False, "error": "clip_ids must be a list"}]
            }
        
        # Validate all clip_ids upfront
        validated_clip_ids = []
        validation_errors = []
        
        for i, clip_id in enumerate(clip_ids):
            try:
                validated_clip_id = validate_clip_id(clip_id)
                validated_clip_ids.append(validated_clip_id)
            except ValueError as e:
                validation_errors.append({
                    "index": i,
                    "clip_id": clip_id,
                    "error": str(e)
                })
        
        # If there are validation errors, return them
        if validation_errors:
            return {
                "total": len(clip_ids),
                "successful": 0,
                "failed": len(clip_ids),
                "validation_errors": validation_errors,
                "results": []
            }
        
        total = len(validated_clip_ids)
        successful = 0
        failed = 0
        results = []
        
        for clip_id in validated_clip_ids:
            result = self.process_clip(clip_id)
            results.append(result)
            
            if result["success"]:
                successful += 1
            else:
                failed += 1
        
        return {
            "total": total,
            "successful": successful,
            "failed": failed,
            "results": results
        }
