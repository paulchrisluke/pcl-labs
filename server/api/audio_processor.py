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

class R2Storage:
    """Simple R2 storage client for uploading files"""
    
    def __init__(self):
        # Validate required environment variables
        self.account_id = self._validate_required_env('CLOUDFLARE_ACCOUNT_ID')
        self.api_token = self._validate_required_env('CLOUDFLARE_API_TOKEN')
        self.bucket = self._validate_required_env('R2_BUCKET')
        
        # Debug logging
        logger.info(f"R2 Configuration - Account ID: {'SET' if self.account_id else 'MISSING'}")
        logger.info(f"R2 Configuration - API Token: {'SET' if self.api_token else 'MISSING'}")
        logger.info(f"R2 Configuration - Bucket: {'SET' if self.bucket else 'MISSING'}")
        
        if not all([self.account_id, self.api_token, self.bucket]):
            logger.warning("Missing required Cloudflare environment variables - R2 uploads will be disabled")
            self.enabled = False
        else:
            logger.info("All R2 environment variables are set - R2 storage is enabled")
            self.enabled = True
            # Use the correct R2 REST API endpoint
            self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/r2/buckets/{self.bucket}/objects"
            self.headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': 'application/json'
            }
    
    def _validate_required_env(self, env_name: str) -> str:
        """Validate and return environment variable value"""
        value = os.getenv(env_name)
        if not value:
            logger.warning(f"Missing environment variable: {env_name}")
        return value or ""
    
    def put_file(self, key: str, file_path: str, content_type: str, metadata: dict = None) -> bool:
        """Upload a file to R2 storage using Cloudflare API"""
        if not self.enabled:
            logger.warning(f"R2 storage disabled - skipping upload of {key}")
            return False
            
        try:
            with open(file_path, 'rb') as f:
                data = f.read()
            return self.put_data(key, data, content_type, metadata)
        except Exception as e:
            logger.error(f"Error uploading file {key}: {e}")
            return False

    def put_data(self, key: str, data: bytes, content_type: str, metadata: dict = None) -> bool:
        """Upload data directly to R2 storage using Cloudflare API"""
        if not self.enabled:
            logger.warning(f"R2 storage disabled - skipping upload of {key}")
            return False
            
        try:
            url = f"{self.base_url}/{key}"
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': content_type
            }
            
            # Add metadata as custom headers if provided
            if metadata:
                for k, v in metadata.items():
                    if isinstance(v, str) and len(v) <= 1024:  # R2 metadata value limit
                        headers[f'x-amz-meta-{k}'] = v
            
            response = requests.put(url, data=data, headers=headers)
            response.raise_for_status()
            logger.info(f"Successfully uploaded {key}")
            return True
        except Exception as e:
            logger.error(f"Error uploading data {key}: {e}")
            return False

    def get_file_url(self, key: str) -> str:
        """Generate public URL for uploaded file"""
        if not self.enabled:
            return f"r2://{self.bucket}/{key}" if self.bucket else f"r2://bucket/{key}"
        return f"https://{self.bucket}.r2.cloudflarestorage.com/{key}"

    def list_objects(self, prefix: str = "clips/", limit: int = 100) -> list:
        """List objects in R2 storage with optional prefix filter"""
        if not self.enabled:
            logger.warning("R2 storage disabled - cannot list objects")
            return []
            
        try:
            url = self.base_url
            params = {
                'prefix': prefix,
                'limit': limit
            }
            
            response = requests.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            
            data = response.json()
            if data.get('success'):
                result = data.get('result', {})
                objects = result.get('objects', []) if isinstance(result, dict) else []
            else:
                logger.error(f"API error listing objects: {data.get('errors', [])}")
                objects = []
            
            # Extract clip IDs from object keys
            clips = []
            for obj in objects:
                key = obj.get('key', '')
                if key.startswith('clips/') and key.endswith(('.mp4', '.mkv', '.webm')):
                    # Extract clip ID from key (e.g., "clips/abc123.mp4" -> "abc123")
                    clip_id = key.replace('clips/', '').split('.')[0]
                    clips.append({
                        'clip_id': clip_id,
                        'key': key,
                        'size': obj.get('size', 0),
                        'uploaded': obj.get('uploaded', ''),
                        'metadata': obj.get('metadata', {})
                    })
            
            return clips
        except Exception as e:
            logger.error(f"Error listing objects: {e}")
            return []

    def get_latest_clip(self) -> dict:
        """Get the most recently uploaded clip from R2 storage"""
        if not self.enabled:
            logger.warning("R2 storage disabled - cannot get latest clip")
            return None
            
        try:
            clips = self.list_objects(prefix="clips/", limit=100)
            
            if not clips:
                logger.info("No clips found in R2 storage")
                return None
            
            # Sort by upload time (newest first)
            clips.sort(key=lambda x: x.get('uploaded', ''), reverse=True)
            
            latest_clip = clips[0]
            logger.info(f"Found latest clip: {latest_clip['clip_id']}")
            return latest_clip
            
        except Exception as e:
            logger.error(f"Error getting latest clip: {e}")
            return None

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        
        # Parse the path to determine the endpoint
        path = self.path.rstrip('/')
        
        if path == '/api/audio_processor/latest':
            # Get latest clip endpoint
            self.handle_get_latest_clip()
        elif path == '/api/audio_processor/clips':
            # List all clips endpoint
            self.handle_list_clips()
        else:
            # Default health check endpoint
            self.handle_health_check()
    
    def handle_health_check(self):
        """Handle the default health check endpoint"""
        r2_storage = R2Storage()
        r2_configured = r2_storage.enabled
        
        response_data = {
            "status": "healthy",
            "service": "Audio Processor",
            "version": "1.0.0",
            "message": "Audio processor is running",
            "r2_configured": r2_configured,
            "note": "R2 upload requires API token with R2 Storage:Edit permissions" if not r2_configured else "R2 storage is configured and ready"
        }
        
        self.wfile.write(json.dumps(response_data).encode('utf-8'))
    
    def handle_get_latest_clip(self):
        """Handle getting the latest clip from R2 storage"""
        r2_storage = R2Storage()
        
        if not r2_storage.enabled:
            response_data = {
                "error": "R2 storage not configured",
                "message": "Cannot retrieve latest clip - R2 storage is disabled"
            }
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            return
        
        latest_clip = r2_storage.get_latest_clip()
        
        if latest_clip:
            response_data = {
                "success": True,
                "latest_clip": latest_clip,
                "message": f"Found latest clip: {latest_clip['clip_id']}"
            }
        else:
            response_data = {
                "success": False,
                "message": "No clips found in R2 storage"
            }
        
        self.wfile.write(json.dumps(response_data).encode('utf-8'))
    
    def handle_list_clips(self):
        """Handle listing all clips from R2 storage"""
        r2_storage = R2Storage()
        
        if not r2_storage.enabled:
            response_data = {
                "error": "R2 storage not configured",
                "message": "Cannot list clips - R2 storage is disabled"
            }
            self.wfile.write(json.dumps(response_data).encode('utf-8'))
            return
        
        clips = r2_storage.list_objects(prefix="clips/", limit=100)
        
        response_data = {
            "success": True,
            "total_clips": len(clips),
            "clips": clips,
            "message": f"Found {len(clips)} clips in R2 storage"
        }
        
        self.wfile.write(json.dumps(response_data).encode('utf-8'))
    
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
        try:
            # Safely validate and read request body
            content_length = self._validate_content_length()
            if content_length is None:
                return  # Error response already sent
                
            body = self.rfile.read(content_length)
            data = json.loads(body.decode('utf-8'))
            
            clip_ids = data.get('clip_ids', [])
            background = data.get('background', False)
            
            if not clip_ids or not isinstance(clip_ids, list):
                self.send_error_response(400, 'clip_ids array is required')
                return
                
            if len(clip_ids) > 10:
                self.send_error_response(400, 'Maximum 10 clips per request')
                return
            
            print(f"🎵 Processing {len(clip_ids)} clips...")
            
            # Process clips
            results = self.process_clips(clip_ids)
            
            # Send response
            self.send_success_response({
                "success": results["failed"] == 0,
                "message": f"Processed {results['successful']}/{results['total']} clips successfully",
                "results": results
            })
            
        except Exception as e:
            print(f"Error processing clips: {e}")
            self.send_error_response(500, str(e))
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def send_success_response(self, data):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))
    
    def send_error_response(self, status_code, message):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
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
            "note": "MP4 downloaded and uploaded to R2 storage"
        }
        
        # Initialize R2 storage
        r2_storage = R2Storage()
        
        try:
            # Create temporary directory
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir)
                
                # Download video file
                print(f"Downloading clip {validated_clip_id}...")
                video_path = self.download_clip_video(validated_clip_id, tmp_path)
                
                if not video_path.exists() or video_path.stat().st_size == 0:
                    result["error"] = "Failed to download video file"
                    return result
                
                # Upload to R2 storage
                print(f"Uploading clip {validated_clip_id} to R2...")
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
                
                if r2_storage.put_file(r2_key, str(video_path), content_type, metadata):
                    # Get clip info with R2 URL
                    clip_info = self.get_clip_info(validated_clip_id)
                    clip_info["file_size"] = video_path.stat().st_size
                    clip_info["file_path"] = r2_storage.get_file_url(r2_key)
                    clip_info["r2_key"] = r2_key
                    clip_info["file_format"] = file_extension[1:]  # Remove the dot
                    
                    result["success"] = True
                    result["clip_info"] = clip_info
                    result["note"] = f"Video file ({file_extension[1:]}) downloaded and uploaded to R2 successfully"
                    print(f"Successfully processed clip {clip_id} - uploaded to R2")
                else:
                    result["error"] = "Failed to upload video file to R2 storage"
                    print(f"Failed to upload clip {clip_id} to R2")
                
                return result
                
        except Exception as e:
            result["error"] = str(e)
            print(f"Error processing clip {clip_id}: {e}")
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
