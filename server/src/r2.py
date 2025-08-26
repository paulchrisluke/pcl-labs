import os
import requests
import logging
from typing import Dict, Optional, Any
from pathlib import Path

# Configure logging
logger = logging.getLogger(__name__)

class R2Storage:
    def __init__(self):
        # Validate required environment variables
        self.account_id = self._validate_required_env('CLOUDFLARE_ACCOUNT_ID')
        self.zone_id = self._validate_required_env('CLOUDFLARE_ZONE_ID')
        self.api_token = self._validate_required_env('CLOUDFLARE_API_TOKEN')
        self.bucket = self._validate_required_env('R2_BUCKET')
        
        if not all([self.account_id, self.zone_id, self.api_token, self.bucket]):
            raise ValueError("Missing required Cloudflare environment variables")
        
        self.base_url = f"https://api.cloudflare.com/client/v4/accounts/{self.account_id}/storage/buckets/{self.bucket}"
        self.headers = {
            'Authorization': f'Bearer {self.api_token}',
            'Content-Type': 'application/json'
        }
    
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
        try:
            env_value = os.getenv(env_name)
            if not env_value:
                logger.error(f"Required environment variable {env_name} is missing or empty")
                return ""
            
            # Trim whitespace
            env_value = env_value.strip()
            
            if not env_value:
                logger.error(f"Required environment variable {env_name} is empty after trimming")
                return ""
            
            logger.info(f"Using {env_name} = '{env_value[:8]}...' (truncated for security)")
            return env_value
            
        except Exception as e:
            logger.error(f"Error validating {env_name}: {e}")
            return ""
    
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
                
                # Ensure ASCII compatibility
                try:
                    key.encode('ascii')
                    value.encode('ascii')
                except UnicodeEncodeError:
                    logger.warning(f"Metadata key or value contains non-ASCII characters, skipping: {key}")
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
        """Upload a file to R2 storage using Cloudflare API"""
        try:
            with open(file_path, 'rb') as f:
                data = f.read()
            return self.put_data(key, data, content_type, metadata)
        except Exception as e:
            logger.error(f"Error uploading file {key}: {e}")
            return False

    def put_data(self, key: str, data: bytes, content_type: str, metadata: Optional[Dict[str, str]] = None) -> bool:
        """Upload data directly to R2 storage using Cloudflare API"""
        try:
            url = f"{self.base_url}/objects/{key}"
            headers = {
                'Authorization': f'Bearer {self.api_token}',
                'Content-Type': content_type
            }
            
            # Add metadata as custom headers if provided
            if metadata:
                validated_metadata = self._validate_metadata(metadata)
                if validated_metadata:
                    for k, v in validated_metadata.items():
                        headers[f'X-Meta-{k}'] = v
            
            response = requests.put(url, data=data, headers=headers)
            response.raise_for_status()
            logger.info(f"Successfully uploaded {key}")
            return True
        except Exception as e:
            logger.error(f"Error uploading data {key}: {e}")
            return False

    def get_file(self, key: str) -> Optional[bytes]:
        """Download a file from R2 storage using Cloudflare API"""
        try:
            url = f"{self.base_url}/objects/{key}"
            headers = {'Authorization': f'Bearer {self.api_token}'}
            
            response = requests.get(url, headers=headers)
            response.raise_for_status()
            return response.content
        except Exception as e:
            logger.error(f"Error downloading {key}: {e}")
            return None

    def file_exists(self, key: str) -> bool:
        """Check if a file exists in R2 storage using Cloudflare API"""
        try:
            url = f"{self.base_url}/objects/{key}"
            headers = {'Authorization': f'Bearer {self.api_token}'}
            
            response = requests.head(url, headers=headers)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error checking if file exists {key}: {e}")
            return False

    def list_files(self, prefix: str = "", limit: Optional[int] = None, cursor: Optional[str] = None) -> Dict[str, Any]:
        """
        List files in R2 storage with given prefix using Cloudflare API
        
        Args:
            prefix: File prefix to filter by
            limit: Maximum number of objects to return (optional)
            cursor: Pagination cursor for continuing from a previous request (optional)
        
        Returns:
            Dictionary containing:
            - 'objects': List of object names
            - 'cursor': Next cursor for pagination (if more results available)
            - 'truncated': Boolean indicating if there are more results
        """
        try:
            url = f"{self.base_url}/objects"
            params = {}
            
            if prefix:
                params['prefix'] = prefix
            if limit is not None:
                params['limit'] = limit
            if cursor:
                params['cursor'] = cursor
                
            headers = {'Authorization': f'Bearer {self.api_token}'}
            
            response = requests.get(url, params=params, headers=headers)
            response.raise_for_status()
            
            data = response.json()
            if data.get('success'):
                result = data.get('result', {})
                objects = [obj['name'] for obj in result.get('objects', [])]
                
                return {
                    'objects': objects,
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
            logger.error(f"Error listing files with prefix {prefix}: {e}")
            return {
                'objects': [],
                'cursor': None,
                'truncated': False
            }

    def delete(self, key: str) -> bool:
        """Delete a file from R2 storage using Cloudflare API"""
        try:
            url = f"{self.base_url}/objects/{key}"
            headers = {'Authorization': f'Bearer {self.api_token}'}
            
            response = requests.delete(url, headers=headers)
            response.raise_for_status()
            logger.info(f"Successfully deleted {key}")
            return True
        except Exception as e:
            logger.error(f"Error deleting {key}: {e}")
            return False
