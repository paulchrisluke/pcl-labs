import subprocess
import shutil
import re
import logging
from pathlib import Path
from typing import Optional, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def ensure_ffmpeg() -> bool:
    """Check if ffmpeg is available in PATH"""
    if not shutil.which("ffmpeg"):
        logger.error("ffmpeg not found in PATH")
        return False
    return True

def ensure_ffprobe() -> bool:
    """Check if ffprobe is available in PATH"""
    if not shutil.which("ffprobe"):
        logger.error("ffprobe not found in PATH")
        return False
    return True

def mp4_to_wav16k(src_mp4: Path, dst_wav: Path, sample_rate: int = 16000, channels: int = 1, timeout: int = 300) -> bool:
    """Convert MP4 to WAV with specified sample rate and channels"""
    try:
        # Validate input file
        if not src_mp4.exists():
            logger.error(f"Source file does not exist: {src_mp4}")
            return False
        
        if not src_mp4.is_file():
            logger.error(f"Source path is not a file: {src_mp4}")
            return False
        
        # Ensure output directory exists
        dst_wav.parent.mkdir(parents=True, exist_ok=True)
        
        # FFmpeg command for audio extraction
        cmd = [
            "ffmpeg",
            "-nostdin",  # Non-interactive mode
            "-y",        # Overwrite output files
            "-i", str(src_mp4),
            "-vn",       # No video
            "-ac", str(channels),  # Number of audio channels
            "-ar", str(sample_rate),  # Sample rate
            "-acodec", "pcm_s16le",  # 16-bit PCM encoding
            str(dst_wav)
        ]
        
        # Run FFmpeg command with timeout
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=timeout)
        
        # Verify output file exists and has content
        if dst_wav.exists() and dst_wav.stat().st_size > 0:
            logger.info(f"Successfully converted {src_mp4} to {dst_wav}")
            return True
        else:
            logger.error(f"Output file {dst_wav} is empty or missing")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error(f"FFmpeg conversion timed out after {timeout} seconds for {src_mp4}")
        return False
    except subprocess.CalledProcessError as e:
        logger.error(f"FFmpeg error: {e}")
        logger.error(f"FFmpeg stderr: {e.stderr}")
        return False
    except Exception as e:
        logger.error(f"Error converting {src_mp4}: {e}")
        return False

def get_audio_duration(file_path: Path) -> Optional[float]:
    """
    Get audio duration in seconds using ffprobe (preferred) or ffmpeg as fallback.
    
    Args:
        file_path: Path to the audio file
        
    Returns:
        Duration in seconds as float, or None if duration cannot be determined
        
    Raises:
        FileNotFoundError: If the file doesn't exist
        ValueError: If file_path is not a file
    """
    # Validate input file
    if not file_path.exists():
        error_msg = f"File does not exist: {file_path}"
        logger.error(error_msg)
        raise FileNotFoundError(error_msg)
    
    if not file_path.is_file():
        error_msg = f"Path is not a file: {file_path}"
        logger.error(error_msg)
        raise ValueError(error_msg)
    
    # Try ffprobe first (more reliable for duration extraction)
    duration = _get_duration_with_ffprobe(file_path)
    if duration is not None:
        return duration
    
    # Fallback to ffmpeg if ffprobe fails
    logger.warning(f"ffprobe failed, falling back to ffmpeg for {file_path}")
    return _get_duration_with_ffmpeg(file_path)

def _get_duration_with_ffprobe(file_path: Path) -> Optional[float]:
    """Get duration using ffprobe with robust error handling"""
    if not ensure_ffprobe():
        return None
    
    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            str(file_path)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            logger.error(f"ffprobe failed with return code {result.returncode}")
            if result.stderr:
                logger.error(f"ffprobe stderr: {result.stderr}")
            return None
        
        # Parse the duration output
        duration_str = result.stdout.strip()
        if not duration_str:
            logger.error("ffprobe returned empty duration")
            return None
        
        try:
            duration = float(duration_str)
            if duration <= 0:
                logger.error(f"Invalid duration from ffprobe: {duration}")
                return None
            return duration
        except ValueError as e:
            logger.error(f"Failed to parse ffprobe duration '{duration_str}': {e}")
            return None
            
    except subprocess.TimeoutExpired:
        logger.error(f"ffprobe timed out for {file_path}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in ffprobe for {file_path}: {e}")
        return None

def _get_duration_with_ffmpeg(file_path: Path) -> Optional[float]:
    """Get duration using ffmpeg with robust parsing and error handling"""
    if not ensure_ffmpeg():
        return None
    
    try:
        cmd = [
            "ffmpeg",
            "-i", str(file_path),
            "-f", "null",
            "-"
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        # ffmpeg typically returns non-zero for this command, so we don't check return code
        # Instead, we look for duration in stderr output
        
        if not result.stderr:
            logger.error("ffmpeg stderr is empty, cannot parse duration")
            return None
        
        # Use regex to match duration pattern with variable decimals and localization
        # Pattern matches: Duration: HH:MM:SS.mm or Duration: HH:MM:SS,mm (comma as decimal separator)
        duration_pattern = r'Duration:\s*(\d{2}):(\d{2}):(\d{2}[.,]\d+)'
        match = re.search(duration_pattern, result.stderr)
        
        if not match:
            logger.error(f"Could not find duration pattern in ffmpeg output for {file_path}")
            logger.debug(f"ffmpeg stderr: {result.stderr}")
            return None
        
        try:
            hours = int(match.group(1))
            minutes = int(match.group(2))
            # Handle both comma and period as decimal separators
            seconds_str = match.group(3).replace(',', '.')
            seconds = float(seconds_str)
            
            total_seconds = hours * 3600 + minutes * 60 + seconds
            
            if total_seconds <= 0:
                logger.error(f"Invalid calculated duration: {total_seconds}")
                return None
            
            return total_seconds
            
        except (ValueError, IndexError) as e:
            logger.error(f"Failed to parse duration components: {e}")
            return None
            
    except subprocess.TimeoutExpired:
        logger.error(f"ffmpeg timed out for {file_path}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in ffmpeg for {file_path}: {e}")
        return None

def chunk_audio(input_wav: Path, output_dir: Path, chunk_duration: int = 90) -> list[Path]:
    """Split audio into chunks for processing long clips"""
    try:
        # Validate input parameters
        if not input_wav.exists():
            logger.error(f"Input file does not exist: {input_wav}")
            return []
        
        if input_wav.stat().st_size == 0:
            logger.error(f"Input file is empty: {input_wav}")
            return []
        
        if chunk_duration <= 0:
            logger.error(f"Invalid chunk duration: {chunk_duration}")
            return []
        
        # Create output directory
        try:
            output_dir.mkdir(parents=True, exist_ok=True)
        except Exception as e:
            logger.error(f"Error creating output directory {output_dir}: {e}")
            return []
        
        # Get total duration
        try:
            total_duration = get_audio_duration(input_wav)
            if not total_duration or total_duration <= 0:
                logger.error(f"Could not determine audio duration for {input_wav}")
                return []
        except (FileNotFoundError, ValueError) as e:
            logger.error(f"Error getting duration for {input_wav}: {e}")
            return []
        
        # Calculate number of chunks
        num_chunks = int((total_duration + chunk_duration - 1) // chunk_duration)
        if num_chunks <= 0:
            logger.error(f"Invalid number of chunks calculated: {num_chunks}")
            return []
        
        logger.info(f"Creating {num_chunks} chunks of {chunk_duration}s each from {total_duration:.1f}s audio")
        chunk_files = []
        
        for i in range(num_chunks):
            try:
                start_time = i * chunk_duration
                output_file = output_dir / f"{i:03d}.wav"
                
                cmd = [
                    "ffmpeg",
                    "-nostdin",
                    "-y",
                    "-i", str(input_wav),
                    "-ss", str(start_time),
                    "-t", str(chunk_duration),
                    "-acodec", "pcm_s16le",
                    "-ar", "16000",
                    "-ac", "1",
                    str(output_file)
                ]
                
                result = subprocess.run(cmd, capture_output=True, text=True, check=True)
                
                # Verify the chunk file was created and has content
                if output_file.exists() and output_file.stat().st_size > 0:
                    chunk_files.append(output_file)
                    logger.info(f"Created chunk {i+1}/{num_chunks}: {output_file}")
                else:
                    logger.error(f"Chunk file {i+1} was not created or is empty: {output_file}")
                    
            except subprocess.CalledProcessError as e:
                logger.error(f"FFmpeg error creating chunk {i+1}: {e}")
                logger.error(f"FFmpeg stderr: {e.stderr}")
                continue
            except Exception as e:
                logger.error(f"Error creating chunk {i+1}: {e}")
                continue
        
        if not chunk_files:
            logger.error(f"No chunks were successfully created for {input_wav}")
            return []
        
        logger.info(f"Successfully created {len(chunk_files)} chunks")
        return chunk_files
        
    except Exception as e:
        logger.error(f"Error chunking audio {input_wav}: {e}")
        return []
