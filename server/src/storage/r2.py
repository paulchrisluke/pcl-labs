import os
import requests
import logging
import urllib.parse
import xml.etree.ElementTree as ET
import hmac
import hashlib
import datetime
from typing import Dict, Optional, Any
from pathlib import Path

# Configure logging
logger = logging.getLogger(__name__)

class R2Storage:
    """
    R2 Storage client for Cloudflare R2 using Bearer token authentication.
    
    Environment Variables:
    - CLOUDFLARE_ACCOUNT_ID: Required - Cloudflare account ID
    - CLOUDFLARE_API_TOKEN: Required - Cloudflare API token with R2 permissions
    - R2_BUCKET: Required - R2 bucket name
    - ALLOW_INSECURE: Optional - Allow insecure TLS connections (default: false)
    """
    
    def __init__(self):
        # Hardcoded timeout and TLS settings
        self.timeout = 10.0  # 10 second timeout for all requests
        self.verify = not self._parse_boolean_env('ALLOW_INSECURE', False)
        
        # Log configuration
        logger.info(f"R2Storage initialized with timeout={self.timeout}s, verify={self.verify}")
        
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
    
    def _parse_boolean_env(self, env_name: str, default: bool) -> bool:
        """Parse boolean environment variable with sensible defaults"""
        value = os.getenv(env_name, str(default)).lower()
        return value in ('true', '1', 'yes', 'on', 'enabled')
    
    def _validate_required_env(self, env_name: str) -> str:
        """
        Validate required environment variable.
        
        Args:
            env_name: Name of the environment variable
        
        Returns:
            Validated string value
        
        Raises:
            ValueError: If environment variable is missing or empty
        """
        env_value = os.getenv(env_name)
        if not env_value:
            logger.error(f"Required environment variable {env_name} is missing or empty")
            raise ValueError(f"Missing required environment variable: {env_name}")
        
        # Trim whitespace
        env_value = env_value.strip()
        
        if not env_value:
            logger.error(f"Required environment variable {env_name} is empty after trimming")
            raise ValueError(f"Empty environment variable after trimming: {env_name}")
        
        logger.info(f"Using {env_name} = '{env_value[:8]}...' (truncated for security)")
        return env_value

    def _validate_metadata(self, metadata: Dict[str, str]) -> Optional[Dict[str, str]]:
        """
        Validate metadata dictionary for R2 storage.
        
        Args:
            metadata: Dictionary of metadata key-value pairs
        
        Returns:
            Validated metadata dictionary or None if validation fails
        
        R2/S3 metadata requirements:
        - Keys must be ASCII strings
        - Values must be ASCII strings
        - Keys cannot start with 'x-amz-'
        - Keys and values have size limits
        """
        try:
            if not isinstance(metadata, dict):
                logger.error(f"Metadata must be a dictionary, got {type(metadata)}")
                return None
            
            validated_metadata = {}
            
            for key, value in metadata.items():
                # Validate key
                if not isinstance(key, str):
                    logger.warning(f"Metadata key must be string, skipping key {key} (type: {type(key)})")
                    continue
                
                # Check key length (S3 limit is 128 bytes)
                if len(key.encode('utf-8')) > 128:
                    logger.warning(f"Metadata key too long, skipping: {key}")
                    continue
                
                # Check for reserved prefixes
                if key.lower().startswith('x-amz-'):
                    logger.warning(f"Metadata key cannot start with 'x-amz-', skipping: {key}")
                    continue
                
                # Validate value
                if not isinstance(value, str):
                    # Convert non-string values to string
                    try:
                        value = str(value)
                    except Exception as e:
                        logger.warning(f"Could not convert metadata value to string, skipping key {key}: {e}")
                        continue
                
                # Check value length (S3 limit is 256 bytes)
                if len(value.encode('utf-8')) > 256:
                    logger.warning(f"Metadata value too long, truncating: {key}")
                    # Truncate to fit within limits while preserving UTF-8 characters
                    value_bytes = value.encode('utf-8')
                    truncated_bytes = value_bytes[:256]
                    value = truncated_bytes.decode('utf-8', errors='ignore')
                
                # Encode non-ASCII characters to preserve data while ensuring compatibility
                try:
                    # Try ASCII encoding first
                    key.encode('ascii')
                    value.encode('ascii')
                except UnicodeEncodeError:
                    # If non-ASCII characters exist, encode them as URL-safe strings
                    try:
                        safe_key = urllib.parse.quote(key, safe='/-_.~')
                        safe_value = urllib.parse.quote(value, safe='/-_.~')
                        
                        # Check if encoded values are still within limits
                        if len(safe_key.encode('utf-8')) <= 128 and len(safe_value.encode('utf-8')) <= 256:
                            key = safe_key
                            value = safe_value
                            logger.info(f"Encoded non-ASCII metadata: {key} -> {safe_key}")
                        else:
                            logger.warning(f"Encoded metadata too long, skipping: {key}")
                            continue
                    except Exception as encode_error:
                        logger.warning(f"Failed to encode non-ASCII metadata, skipping: {key} - {encode_error}")
                        continue
                
                validated_metadata[key] = value
            
            if not validated_metadata:
                logger.warning("No valid metadata entries found")
                return None
            
            logger.info(f"Validated metadata with {len(validated_metadata)} entries")
            return validated_metadata
            
        except Exception as e:
            logger.error(f"Error validating metadata: {e}")
            return None

    def put_file(self, key: str, file_path: str, content_type: str, metadata: Optional[Dict[str, str]] = None) -> bool:
        """Upload a file to R2 storage using R2 REST API"""
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

    def put_data(self, key: str, data: bytes, content_type: str, metadata: Optional[Dict[str, str]] = None) -> bool:
        """Upload data directly to R2 storage using R2 REST API"""
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
                validated_metadata = self._validate_metadata(metadata)
                if validated_metadata:
                    for k, v in validated_metadata.items():
                        headers[f'x-amz-meta-{k}'] = v
            
            response = requests.put(url, data=data, headers=headers, timeout=self.timeout, verify=self.verify)
            response.raise_for_status()
            logger.info(f"Successfully uploaded {key}")
            return True
        except Exception as e:
            logger.error(f"Error uploading data {key}: {e}")
            return False

    def get_file(self, key: str) -> Optional[bytes]:
        """Download a file from R2 storage using R2 REST API"""
        if not self.enabled:
            logger.warning(f"R2 storage disabled - cannot download {key}")
            return None
            
        try:
            url = f"{self.base_url}/{key}"
            headers = {'Authorization': f'Bearer {self.api_token}'}
            
            response = requests.get(url, headers=headers, timeout=self.timeout, verify=self.verify)
            response.raise_for_status()
            return response.content
        except Exception as e:
            logger.error(f"Error downloading file {key}: {e}")
            return None

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
            
            response = requests.get(url, headers=self.headers, params=params, timeout=self.timeout, verify=self.verify)
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

    def list_files(self, prefix: str = "", limit: int = 100, cursor: Optional[str] = None) -> Dict[str, Any]:
        """List files in R2 storage with pagination support"""
        if not self.enabled:
            logger.warning("R2 storage disabled - cannot list files")
            return {
                'objects': [],
                'cursor': None,
                'truncated': False
            }
            
        try:
            url = self.base_url
            params = {
                'prefix': prefix,
                'limit': limit
            }
            
            if cursor:
                params['cursor'] = cursor
            
            response = requests.get(url, headers=self.headers, params=params, timeout=self.timeout, verify=self.verify)
            response.raise_for_status()
            
            data = response.json()
            if data.get('success'):
                result = data.get('result', {})
                objects = result.get('objects', []) if isinstance(result, dict) else []
                # Extract just the keys for the API response
                file_keys = [obj.get('key', '') for obj in objects if obj.get('key')]
                return {
                    'objects': file_keys,
                    'cursor': result.get('cursor'),
                    'truncated': result.get('truncated', False)
                }
            else:
                logger.error(f"API error listing files: {data.get('errors', [])}")
                return {
                    'objects': [],
                    'cursor': None,
                    'truncated': False
                }
        except Exception as e:
            logger.error(f"Error listing files: {e}")
            return {
                'objects': [],
                'cursor': None,
                'truncated': False
            }

    def file_exists(self, key: str) -> bool:
        """Check if a file exists in R2 storage"""
        if not self.enabled:
            logger.warning(f"R2 storage disabled - cannot check existence of {key}")
            return False
            
        try:
            url = f"{self.base_url}/{key}"
            headers = {'Authorization': f'Bearer {self.api_token}'}
            
            response = requests.head(url, headers=headers, timeout=self.timeout, verify=self.verify)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error checking file existence for {key}: {e}")
            return False

    def get_latest_clip(self) -> Optional[dict]:
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

    def delete_file(self, key: str) -> bool:
        """Delete a file from R2 storage using R2 REST API"""
        if not self.enabled:
            logger.warning(f"R2 storage disabled - cannot delete {key}")
            return False
            
        try:
            url = f"{self.base_url}/{key}"
            headers = {'Authorization': f'Bearer {self.api_token}'}
            
            response = requests.delete(url, headers=headers, timeout=self.timeout, verify=self.verify)
            response.raise_for_status()
            logger.info(f"Successfully deleted {key}")
            return True
        except Exception as e:
            logger.error(f"Error deleting file {key}: {e}")
            return False

    def _create_validated_metadata(self, clip_id: str, duration: Optional[float], timestamp: str) -> Dict[str, str]:
        """Create validated metadata for clip uploads"""
        metadata = {
            'clip_id': clip_id,
            'uploaded_at': timestamp,
            'source': 'twitch'
        }
        
        if duration is not None:
            metadata['duration'] = str(duration)
        
        return metadata

    def _create_chunk_metadata(self, base_metadata: Dict[str, str], chunk_index: int, total_chunks: int) -> Dict[str, str]:
        """Create metadata for audio chunk uploads"""
        chunk_metadata = base_metadata.copy()
        chunk_metadata['chunk_index'] = str(chunk_index)
        chunk_metadata['total_chunks'] = str(total_chunks)
        chunk_metadata['chunk_type'] = 'audio_segment'
        return chunk_metadata
