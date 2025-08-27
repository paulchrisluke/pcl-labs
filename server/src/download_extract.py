import os
import tempfile
import json
import time
import logging
import subprocess
import re
import urllib.parse
from pathlib import Path
from typing import Dict, Optional, Tuple, Any, List
from dotenv import load_dotenv
from yt_dlp import YoutubeDL
from .storage.r2 import R2Storage
from .ffmpeg_utils import ensure_ffmpeg, mp4_to_wav16k, mp4_to_whisper_audio, get_audio_duration, chunk_audio

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class AudioProcessor:
    def __init__(self):
        self.r2 = R2Storage()
        self.max_clip_duration = self._validate_int_env('MAX_CLIP_DURATION', 300, min_value=1, max_value=3600)
        self.sample_rate = self._validate_int_env('AUDIO_SAMPLE_RATE', 16000, min_value=8000, max_value=48000)
        self.channels = self._validate_int_env('AUDIO_CHANNELS', 1, min_value=1, max_value=2)
    
    def _validate_int_env(self, env_name: str, default: int, min_value: int = None, max_value: int = None) -> int:
        """
        Validate and convert environment variable to integer with bounds checking.
        
        Args:
            env_name: Name of the environment variable
            default: Default value if env var is not set or invalid
            min_value: Minimum allowed value (inclusive)
            max_value: Maximum allowed value (inclusive)
        
        Returns:
            Validated integer value
        
        Raises:
            ValueError: If validation fails (should not happen with proper defaults)
        """
        try:
            env_value = os.getenv(env_name)
            if env_value is None:
                logger.info(f"Environment variable {env_name} not set, using default: {default}")
                return default
            
            # Try to convert to integer
            try:
                int_value = int(env_value)
            except ValueError:
                logger.warning(f"Invalid integer value for {env_name}: '{env_value}', using default: {default}")
                return default
            
            # Validate bounds
            if min_value is not None and int_value < min_value:
                logger.warning(f"Value for {env_name} ({int_value}) is below minimum ({min_value}), using default: {default}")
                return default
            
            if max_value is not None and int_value > max_value:
                logger.warning(f"Value for {env_name} ({int_value}) is above maximum ({max_value}), using default: {default}")
                return default
            
            logger.info(f"Using {env_name} = {int_value}")
            return int_value
            
        except Exception as e:
            logger.error(f"Error validating {env_name}: {e}, using default: {default}")
            return default
    
    def _validate_bool_env(self, env_name: str, default: bool) -> bool:
        """
        Validate and convert environment variable to boolean.
        
        Args:
            env_name: Name of the environment variable
            default: Default value if env var is not set or invalid
        
        Returns:
            Validated boolean value
        """
        try:
            env_value = os.getenv(env_name)
            if env_value is None:
                logger.info(f"Environment variable {env_name} not set, using default: {default}")
                return default
            
            # Convert to lowercase for case-insensitive comparison
            env_value_lower = env_value.lower().strip()
            
            # Check for truthy values
            if env_value_lower in ['true', '1', 'yes', 'on', 'enabled']:
                logger.info(f"Using {env_name} = True")
                return True
            
            # Check for falsy values
            if env_value_lower in ['false', '0', 'no', 'off', 'disabled', '']:
                logger.info(f"Using {env_name} = False")
                return False
            
            # Invalid value
            logger.warning(f"Invalid boolean value for {env_name}: '{env_value}', using default: {default}")
            return default
            
        except Exception as e:
            logger.error(f"Error validating {env_name}: {e}, using default: {default}")
            return default
    
    def _validate_string_env(self, env_name: str, default: str) -> str:
        """
        Validate and return environment variable as string.
        
        Args:
            env_name: Name of the environment variable
            default: Default value if env var is not set
        
        Returns:
            Validated string value
        """
        try:
            env_value = os.getenv(env_name)
            if env_value is None:
                logger.info(f"Environment variable {env_name} not set, using default: '{default}'")
                return default
            
            # Validate that it's a string and not empty (unless default is empty)
            if not isinstance(env_value, str):
                logger.warning(f"Invalid string value for {env_name}: {type(env_value)}, using default: '{default}'")
                return default
            
            # Trim whitespace
            env_value = env_value.strip()
            
            logger.info(f"Using {env_name} = '{env_value}'")
            return env_value
            
        except Exception as e:
            logger.error(f"Error validating {env_name}: {e}, using default: '{default}'")
            return default
    
    def _should_disable_ssl_verification(self) -> bool:
        """
        Determine if SSL certificate verification should be disabled.
        Only allows disabling in development/testing environments.
        """
        # Check for explicit insecure override with validation
        allow_insecure = self._validate_bool_env('ALLOW_INSECURE', False)
        debug_mode = self._validate_bool_env('DEBUG', False)
        node_env = self._validate_string_env('NODE_ENV', '').lower()
        python_env = self._validate_string_env('PYTHON_ENV', '').lower()
        
        # Production environments - never allow insecure SSL
        if node_env == 'production' or python_env == 'production':
            if allow_insecure:
                raise RuntimeError("SSL certificate verification cannot be disabled in production environment for security reasons")
            return False
        
        # Development/testing environments - allow disabling if explicitly configured
        is_dev_env = (
            debug_mode or
            node_env in ['development', 'dev', 'test'] or
            python_env in ['development', 'dev', 'test'] or
            allow_insecure
        )
        
        if is_dev_env and allow_insecure:
            logger.info("SSL certificate verification disabled for development/testing environment")
            return True
        
        # Default: enable SSL verification
        return False

    def _encode_metadata_item(self, key: str, value: str, max_key_len: int = 128, max_value_len: int = 256) -> Optional[Tuple[str, str]]:
        """
        Encode and validate a metadata key-value pair.
        
        Args:
            key: Metadata key
            value: Metadata value
            max_key_len: Maximum allowed key length in bytes
            max_value_len: Maximum allowed value length in bytes
        
        Returns:
            Tuple of (encoded_key, encoded_value) or None if validation fails
        """
        # Ensure value is string
        if not isinstance(value, str):
            try:
                value = str(value)
            except Exception as e:
                logger.warning(f"Could not convert metadata value to string for {key}: {e}")
                return None
        
        # Validate key length
        if len(key.encode('utf-8')) > max_key_len:
            logger.warning(f"Metadata key too long, skipping: {key}")
            return None
        
        # Validate and truncate value if needed
        if len(value.encode('utf-8')) > max_value_len:
            logger.warning(f"Metadata value too long, truncating: {key}")
            value_bytes = value.encode('utf-8')
            truncated_bytes = value_bytes[:max_value_len]
            value = truncated_bytes.decode('utf-8', errors='ignore')
        
        # Encode non-ASCII characters to preserve data while ensuring compatibility
        try:
            # Try ASCII encoding first
            key.encode('ascii')
            value.encode('ascii')
            return (key, value)
        except UnicodeEncodeError:
            # If non-ASCII characters exist, encode them as URL-safe strings
            try:
                safe_key = urllib.parse.quote(key, safe='/-_.~')
                safe_value = urllib.parse.quote(value, safe='/-_.~')
                
                # Check if encoded values are still within limits
                if len(safe_key.encode('utf-8')) <= max_key_len and len(safe_value.encode('utf-8')) <= max_value_len:
                    logger.info(f"Encoded non-ASCII metadata: {key} -> {safe_key}")
                    return (safe_key, safe_value)
                else:
                    logger.warning(f"Encoded metadata too long, skipping: {key}")
                    return None
            except Exception as encode_error:
                logger.warning(f"Failed to encode non-ASCII metadata, skipping: {key} - {encode_error}")
                return None

    def _create_validated_metadata(self, clip_id: str, duration: Optional[float], created_at: str) -> Dict[str, str]:
        """
        Create and validate metadata for file uploads.
        
        Args:
            clip_id: The clip ID
            duration: Audio/video duration in seconds
            created_at: ISO timestamp of creation
        
        Returns:
            Validated metadata dictionary
        """
        try:
            # Create base metadata
            metadata = {
                "status": "ready_for_asr",
                "source": "twitch",
                "created_at": created_at,
                "clip_id": clip_id,
                "sample_rate": str(self.sample_rate),
                "channels": str(self.channels)
            }
            
            # Add duration if available
            if duration is not None:
                try:
                    # Validate duration is a reasonable number
                    if 0 <= duration <= 86400:  # 0 to 24 hours
                        metadata["duration"] = f"{duration:.3f}"
                    else:
                        logger.warning(f"Duration {duration} is outside reasonable range (0-86400), using 'unknown'")
                        metadata["duration"] = "unknown"
                except (ValueError, TypeError):
                    logger.warning(f"Invalid duration value {duration}, using 'unknown'")
                    metadata["duration"] = "unknown"
            else:
                metadata["duration"] = "unknown"
            
            # Validate all metadata values
            validated_metadata = {}
            for key, value in metadata.items():
                result = self._encode_metadata_item(key, value)
                if result is not None:
                    encoded_key, encoded_value = result
                    validated_metadata[encoded_key] = encoded_value
            
            logger.info(f"Created validated metadata for {clip_id} with {len(validated_metadata)} entries")
            return validated_metadata
            
        except Exception as e:
            logger.error(f"Error creating metadata for {clip_id}: {e}")
            # Return minimal safe metadata
            return {
                "status": "ready_for_asr",
                "source": "twitch",
                "clip_id": clip_id[:50] if clip_id else "unknown"  # Truncate if too long
            }
    
    def _create_chunk_metadata(self, base_metadata: Dict[str, str], chunk_index: int, total_chunks: int) -> Dict[str, str]:
        """
        Create validated metadata for audio chunks.
        
        Args:
            base_metadata: Base metadata dictionary
            chunk_index: Index of the chunk (0-based)
            total_chunks: Total number of chunks
        
        Returns:
            Validated chunk metadata dictionary
        """
        try:
            # Create chunk metadata by extending base metadata
            chunk_metadata = base_metadata.copy()
            chunk_metadata.update({
                "chunk_index": str(chunk_index),
                "total_chunks": str(total_chunks),
                "chunk_type": "audio_segment"
            })
            
            # Validate the extended metadata
            validated_metadata = {}
            for key, value in chunk_metadata.items():
                result = self._encode_metadata_item(key, value)
                if result is not None:
                    encoded_key, encoded_value = result
                    validated_metadata[encoded_key] = encoded_value
            
            logger.info(f"Created validated chunk metadata for chunk {chunk_index}/{total_chunks} with {len(validated_metadata)} entries")
            return validated_metadata
            
        except Exception as e:
            logger.error(f"Error creating chunk metadata for chunk {chunk_index}: {e}")
            # Return minimal safe chunk metadata
            return {
                "chunk_index": str(chunk_index),
                "total_chunks": str(total_chunks),
                "chunk_type": "audio_segment",
                "status": "ready_for_asr"
            }
    
    def _check_processing_status(self, clip_id: str) -> Dict[str, Any]:
        """
        Check if a clip is fully processed, including chunks if needed.
        
        Args:
            clip_id: The clip ID to check
        
        Returns:
            Dictionary with processing status information:
            - is_complete: True if fully processed
            - has_partial_files: True if some files exist but processing is incomplete
            - needs_chunking: True if chunking is required
            - existing_files: List of existing files
            - expected_chunks: Number of expected chunks (if chunking needed)
        """
        try:
            existing_files = []
            needs_chunking = False
            expected_chunks = 0
            
            # Check for main files
            main_files = [
                f"clips/{clip_id}.mp4",
                f"audio/{clip_id}.wav"
            ]
            
            for file_key in main_files:
                if self.r2.file_exists(file_key):
                    existing_files.append(file_key)
            
            # If we have the main WAV file, check if we need to determine chunking requirements
            wav_key = f"audio/{clip_id}.wav"
            if wav_key in existing_files:
                # Try to get duration from existing metadata to determine if chunking is needed
                try:
                    # List files to find any existing chunks
                    chunk_prefix = f"audio/{clip_id}/chunk_"
                    all_files_result = self.r2.list_files(chunk_prefix)
                    all_files = all_files_result.get('objects', []) if all_files_result else []
                    if not all_files_result:
                        logger.warning(f"list_files returned None for prefix: {chunk_prefix}")
                    existing_chunks = [f for f in all_files if f.startswith(chunk_prefix) and f.endswith('.wav')]
                    
                    if existing_chunks:
                        # We have chunks, so chunking was needed
                        needs_chunking = True
                        expected_chunks = len(existing_chunks)
                        existing_files.extend(existing_chunks)
                        
                        # Check if we have the expected number of chunks
                        # Calculate expected chunks based on typical chunk duration (90s)
                        chunk_duration = 90  # Default chunk duration
                        # Try to get actual chunk count from metadata if available
                        if existing_chunks:
                            # Sort chunks to get the highest index
                            chunk_indices = []
                            for chunk_file in existing_chunks:
                                try:
                                    # Extract chunk index from filename using regex for robust parsing
                                    filename = chunk_file.split('/')[-1]
                                    # Match pattern: chunk_<digits>.wav
                                    match = re.match(r'^chunk_(\d+)\.wav$', filename)
                                    if match:
                                        chunk_indices.append(int(match.group(1)))
                                except (ValueError, IndexError, AttributeError):
                                    continue
                            
                            if chunk_indices:
                                expected_chunks = max(chunk_indices) + 1  # 0-based indexing
                        
                        logger.info(f"Found {len(existing_chunks)} existing chunks for {clip_id}, expected {expected_chunks}")
                        
                        # Check if we have all expected chunks
                        if len(existing_chunks) >= expected_chunks:
                            logger.info(f"Clip {clip_id} is fully processed with all chunks")
                            return {
                                "is_complete": True,
                                "has_partial_files": False,
                                "needs_chunking": True,
                                "existing_files": existing_files,
                                "expected_chunks": expected_chunks
                            }
                        else:
                            logger.warning(f"Clip {clip_id} has incomplete chunks: {len(existing_chunks)}/{expected_chunks}")
                            return {
                                "is_complete": False,
                                "has_partial_files": True,
                                "needs_chunking": True,
                                "existing_files": existing_files,
                                "expected_chunks": expected_chunks
                            }
                    else:
                        # No chunks found, don't assume clip is complete just because main files exist
                        # Force re-processing so pipeline can decide chunking based on duration
                        logger.info(f"Clip {clip_id} has main files but no chunks - marking incomplete for re-processing")
                        return {
                            "is_complete": False,
                            "has_partial_files": False,
                            "needs_chunking": False,  # Will be determined during processing
                            "existing_files": existing_files,
                            "expected_chunks": 0
                        }
                        
                except Exception as e:
                    logger.warning(f"Error checking chunk status for {clip_id}: {e}")
                    # If we can't determine chunk status, assume incomplete to be safe
                    return {
                        "is_complete": False,
                        "has_partial_files": len(existing_files) > 0,
                        "needs_chunking": False,  # Will be determined during processing
                        "existing_files": existing_files,
                        "expected_chunks": 0
                    }
            else:
                # No main WAV file exists
                if existing_files:
                    logger.info(f"Clip {clip_id} has partial files but missing main WAV")
                    return {
                        "is_complete": False,
                        "has_partial_files": True,
                        "needs_chunking": False,  # Will be determined during processing
                        "existing_files": existing_files,
                        "expected_chunks": 0
                    }
                else:
                    logger.info(f"Clip {clip_id} has no existing files")
                    return {
                        "is_complete": False,
                        "has_partial_files": False,
                        "needs_chunking": False,  # Will be determined during processing
                        "existing_files": [],
                        "expected_chunks": 0
                    }
                    
        except Exception as e:
            logger.error(f"Error checking processing status for {clip_id}: {e}")
            return {
                "is_complete": False,
                "has_partial_files": False,
                "needs_chunking": False,
                "existing_files": [],
                "expected_chunks": 0
            }
    
    def _cleanup_partial_files(self, clip_id: str, file_keys: List[str]) -> None:
        """
        Clean up partial files when reprocessing a clip.
        This method is commented out by default for safety.
        
        Args:
            clip_id: The clip ID
            file_keys: List of file keys to remove
        """
        try:
            logger.info(f"Cleaning up {len(file_keys)} partial files for {clip_id}")
            for file_key in file_keys:
                try:
                    # Note: This would require implementing a delete method in R2Storage
                    # For now, we just log what would be deleted
                    logger.info(f"Would delete partial file: {file_key}")
                    # self.r2.delete_file(file_key)  # Uncomment when delete method is implemented
                except Exception as e:
                    logger.error(f"Error cleaning up file {file_key}: {e}")
        except Exception as e:
            logger.error(f"Error during cleanup for {clip_id}: {e}")

    def twitch_clip_url(self, clip_id: str) -> str:
        """Generate Twitch clip URL for yt-dlp"""
        return f"https://clips.twitch.tv/{clip_id}"
    
    def _convert_to_mp4(self, input_path: Path, output_path: Path) -> bool:
        """
        Convert video file to MP4 format using FFmpeg.
        Handles conversion safely without loading entire file into memory.
        """
        try:
            # Validate input file
            if not input_path.exists():
                logger.error(f"Input file does not exist: {input_path}")
                return False
            
            if input_path.stat().st_size == 0:
                logger.error(f"Input file is empty: {input_path}")
                return False
            
            # Ensure output directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Use FFmpeg for proper format conversion
            cmd = [
                "ffmpeg",
                "-nostdin",  # Non-interactive mode
                "-y",        # Overwrite output files
                "-i", str(input_path),
                "-c:v", "libx264",  # H.264 video codec
                "-c:a", "aac",      # AAC audio codec
                "-preset", "fast",  # Encoding preset for speed
                "-crf", "23",       # Constant rate factor for quality
                "-movflags", "+faststart",  # Optimize for web streaming
                str(output_path)
            ]
            
            logger.info(f"Converting {input_path} to {output_path}")
            result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=300)
            
            # Verify output file
            if output_path.exists() and output_path.stat().st_size > 0:
                logger.info(f"Successfully converted {input_path} to {output_path}")
                return True
            else:
                logger.error(f"Conversion failed: output file {output_path} is missing or empty")
                return False
                
        except subprocess.TimeoutExpired:
            logger.error(f"FFmpeg conversion timed out after 300 seconds for {input_path}")
            return False
        except subprocess.CalledProcessError as e:
            logger.error(f"FFmpeg conversion error: {e}")
            logger.error(f"FFmpeg stderr: {e.stderr}")
            return False
        except Exception as e:
            logger.error(f"Error converting {input_path} to MP4: {e}")
            return False

    def download_clip_mp4(self, clip_id: str, out_dir: Path) -> Optional[Path]:
        """Download Twitch clip as MP4 using yt-dlp"""
        try:
            out_dir.mkdir(parents=True, exist_ok=True)
            out_tmpl = str(out_dir / f"{clip_id}.%(ext)s")
            
            # Configure SSL certificate verification based on environment
            disable_ssl = self._should_disable_ssl_verification()
            
            ydl_opts = {
                "outtmpl": out_tmpl,
                "format": "mp4/best",
                "quiet": True,
                "nocheckcertificate": disable_ssl,
                "no_warnings": True,
            }
            
            with YoutubeDL(ydl_opts) as ydl:
                ydl.download([self.twitch_clip_url(clip_id)])
            
            # Find the downloaded file
            mp4_path = out_dir / f"{clip_id}.mp4"
            if not mp4_path.exists():
                # Fallback: yt-dlp might save with different extension
                found_valid_file = False
                for p in out_dir.glob(f"{clip_id}.*"):
                    if p.suffix in ['.mp4', '.mkv', '.webm']:
                        if p.suffix != '.mp4':
                            # Convert to MP4 using FFmpeg for proper format conversion
                            logger.info(f"Converting {p.suffix} to MP4 for {clip_id}")
                            mp4_path = out_dir / f"{clip_id}.mp4"
                            if self._convert_to_mp4(p, mp4_path):
                                found_valid_file = True
                                break
                            else:
                                logger.error(f"Failed to convert {p} to MP4 for {clip_id}")
                                continue
                        else:
                            mp4_path = p
                            found_valid_file = True
                            break
                
                if not found_valid_file:
                    logger.error(f"No valid video file found for {clip_id}")
                    return None
            
            if mp4_path.exists() and mp4_path.stat().st_size > 0:
                print(f"Successfully downloaded {clip_id} to {mp4_path}")
                return mp4_path
            else:
                print(f"Error: Downloaded file {mp4_path} is empty or missing")
                return None
                
        except Exception as e:
            print(f"Error downloading clip {clip_id}: {e}")
            return None

    def process_clip(self, clip_id: str) -> Dict[str, Any]:
        """Process a single clip: download, extract audio, upload to R2"""
        result = {
            "clip_id": clip_id,
            "success": False,
            "error": None,
            "files_uploaded": [],
            "duration": None,
            "needs_chunking": False
        }
        
        try:
            # Check if already processed (including chunks if needed)
            processing_status = self._check_processing_status(clip_id)
            if processing_status["is_complete"]:
                print(f"Clip {clip_id} already fully processed, skipping")
                result["success"] = True
                result["files_uploaded"] = processing_status["existing_files"]
                result["needs_chunking"] = processing_status["needs_chunking"]
                return result
            elif processing_status["has_partial_files"]:
                print(f"Clip {clip_id} has partial files, will reprocess")
                logger.info(f"Partial files found for {clip_id}: {processing_status['existing_files']}")
                # Optionally clean up partial files (uncomment if you want to remove them)
                # self._cleanup_partial_files(clip_id, processing_status["existing_files"])
            
            # Ensure FFmpeg is available
            if not ensure_ffmpeg():
                result["error"] = "FFmpeg not available"
                return result
            
            # Create temporary directory
            with tempfile.TemporaryDirectory() as tmp_dir:
                tmp_path = Path(tmp_dir)
                
                # Download MP4
                print(f"Downloading clip {clip_id}...")
                mp4_path = self.download_clip_mp4(clip_id, tmp_path)
                if not mp4_path:
                    result["error"] = "Failed to download MP4"
                    return result
                
                # Get duration
                duration = None
                try:
                    duration = get_audio_duration(mp4_path)
                    result["duration"] = duration
                except (FileNotFoundError, ValueError) as e:
                    logger.error(f"Error getting duration for {clip_id}: {e}")
                    duration = None
                    result["duration"] = None
                
                # Validate duration
                if duration is None or duration <= 0:
                    logger.warning(f"Could not determine duration for {clip_id}, assuming no chunking needed")
                    result["duration"] = None
                    result["needs_chunking"] = False
                else:
                    # Check if chunking is needed
                    if duration > self.max_clip_duration:
                        result["needs_chunking"] = True
                        print(f"Clip {clip_id} is {duration:.1f}s long, will need chunking")
                    else:
                        result["needs_chunking"] = False
                        print(f"Clip {clip_id} is {duration:.1f}s long, no chunking needed")
                
                # Extract audio for Whisper (16-bit PCM, mono, 16kHz)
                print(f"Extracting audio from {clip_id}...")
                audio_path = tmp_path / f"{clip_id}.wav"
                
                # Extract audio for Whisper
                if not mp4_to_whisper_audio(mp4_path, audio_path, self.sample_rate, self.channels):
                    result["error"] = "Failed to extract audio"
                    return result
                
                # Upload files to R2
                now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                metadata = self._create_validated_metadata(clip_id, duration, now)
                
                # Upload MP4
                mp4_key = f"clips/{clip_id}.mp4"
                if self.r2.put_file(mp4_key, str(mp4_path), "video/mp4", metadata):
                    result["files_uploaded"].append(mp4_key)
                
                # Upload audio (for Whisper)
                audio_key = f"audio/{clip_id}.wav"
                if self.r2.put_file(audio_key, str(audio_path), "audio/wav", metadata):
                    result["files_uploaded"].append(audio_key)
                
                # If chunking is needed, create WAV and chunks
                if result["needs_chunking"]:
                    try:
                        print(f"Creating WAV and audio chunks for {clip_id}...")
                        wav_path = tmp_path / f"{clip_id}.wav"
                        
                        # Create WAV for chunking
                        if not mp4_to_wav16k(mp4_path, wav_path, self.sample_rate, self.channels):
                            result["error"] = "Failed to create WAV for chunking"
                            return result
                        
                        chunks_dir = tmp_path / "chunks"
                        chunk_files = chunk_audio(wav_path, chunks_dir)
                        
                        # Validate chunking results
                        if not chunk_files:
                            logger.error(f"Chunking failed for {clip_id}: chunk_audio returned empty list")
                            result["error"] = "Failed to create audio chunks"
                            return result
                        
                        if not isinstance(chunk_files, list):
                            logger.error(f"Chunking failed for {clip_id}: chunk_audio returned non-list result: {type(chunk_files)}")
                            result["error"] = "Invalid chunking result"
                            return result
                        
                        # Verify all chunk files exist and have content
                        valid_chunks = []
                        for i, chunk_file in enumerate(chunk_files):
                            if not isinstance(chunk_file, Path):
                                logger.error(f"Invalid chunk file type for {clip_id} chunk {i}: {type(chunk_file)}")
                                continue
                            
                            if not chunk_file.exists():
                                logger.error(f"Chunk file missing for {clip_id} chunk {i}: {chunk_file}")
                                continue
                            
                            if chunk_file.stat().st_size == 0:
                                logger.error(f"Chunk file empty for {clip_id} chunk {i}: {chunk_file}")
                                continue
                            
                            valid_chunks.append((i, chunk_file))
                        
                        if not valid_chunks:
                            logger.error(f"No valid chunks created for {clip_id}")
                            result["error"] = "No valid audio chunks created"
                            return result
                        
                        # Upload valid chunks
                        chunks_uploaded = 0
                        for i, chunk_file in valid_chunks:
                            chunk_key = f"audio/{clip_id}/chunk_{i:03d}.wav"
                            # Create validated chunk metadata
                            chunk_metadata = self._create_chunk_metadata(metadata, i, len(valid_chunks))
                            
                            if self.r2.put_file(chunk_key, str(chunk_file), "audio/wav", chunk_metadata):
                                result["files_uploaded"].append(chunk_key)
                                chunks_uploaded += 1
                            else:
                                logger.error(f"Failed to upload chunk {i} for {clip_id}")
                        
                        if chunks_uploaded == 0:
                            logger.error(f"Failed to upload any chunks for {clip_id}")
                            # Check if we at least have the original WAV file uploaded
                            if wav_key in result["files_uploaded"]:
                                logger.warning(f"Chunking failed for {clip_id}, but original WAV file is available. Processing will continue with full audio file.")
                                result["needs_chunking"] = False  # Mark as not needing chunking since it failed
                                print(f"Continuing with full audio file for {clip_id} (chunking failed)")
                            else:
                                result["error"] = "Failed to upload audio chunks and no fallback available"
                                return result
                        else:
                            print(f"Successfully created and uploaded {chunks_uploaded} chunks for {clip_id}")
                        
                    except Exception as e:
                        logger.error(f"Exception during chunking for {clip_id}: {e}")
                        # Check if we at least have the original WAV file uploaded
                        if wav_key in result["files_uploaded"]:
                            logger.warning(f"Chunking failed for {clip_id}, but original WAV file is available. Processing will continue with full audio file.")
                            result["needs_chunking"] = False  # Mark as not needing chunking since it failed
                            print(f"Continuing with full audio file for {clip_id} (chunking failed)")
                        else:
                            result["error"] = f"Chunking failed: {str(e)}"
                            return result
                
                # Check if any audio assets were uploaded before marking as successful
                if not result["files_uploaded"]:
                    result["error"] = "No audio assets uploaded"
                    logger.error(f"No audio assets uploaded for {clip_id}")
                    return result
                
                result["success"] = True
                print(f"Successfully processed clip {clip_id}")
                return result
                
        except Exception as e:
            result["error"] = str(e)
            print(f"Error processing clip {clip_id}: {e}")
            return result

    def process_clips(self, clip_ids: list[str], task_id: Optional[str] = None) -> Dict[str, Any]:
        """Process multiple clips with optional task status tracking"""
        from .task_manager import task_manager, TaskStatus
        
        # Update task status to running if task_id is provided
        if task_id:
            task_manager.update_task_status(task_id, TaskStatus.RUNNING)
        
        results = {
            "total": len(clip_ids),
            "successful": 0,
            "failed": 0,
            "results": []
        }
        
        try:
            for clip_id in clip_ids:
                result = self.process_clip(clip_id)
                results["results"].append(result)
                
                if result["success"]:
                    results["successful"] += 1
                else:
                    results["failed"] += 1
            
            # Update task status to completed if task_id is provided
            if task_id:
                task_manager.update_task_status(task_id, TaskStatus.COMPLETED, results=results)
            
            return results
            
        except Exception as e:
            error_msg = f"Processing failed: {str(e)}"
            logger.error(error_msg)
            
            # Update task status to failed if task_id is provided
            if task_id:
                task_manager.update_task_status(task_id, TaskStatus.FAILED, error=error_msg)
            
            # Re-raise the exception for backward compatibility
            raise

def main():
    """Command line interface"""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: python -m src.download_extract CLIP_ID [CLIP_ID ...]")
        sys.exit(1)
    
    processor = AudioProcessor()
    clip_ids = sys.argv[1:]
    
    print(f"Processing {len(clip_ids)} clips...")
    results = processor.process_clips(clip_ids)
    
    print(f"\nResults:")
    print(f"Total: {results['total']}")
    print(f"Successful: {results['successful']}")
    print(f"Failed: {results['failed']}")
    
    for result in results["results"]:
        status = "✅" if result["success"] else "❌"
        print(f"{status} {result['clip_id']}: {result.get('error', 'Success')}")

if __name__ == "__main__":
    main()
