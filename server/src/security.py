import os
import time
import hmac
import hashlib
import json
import logging
from typing import Dict, Optional, Tuple
from urllib.parse import urlparse
import re
from .cache import cache

logger = logging.getLogger(__name__)

class SecurityMiddleware:
    """
    Security middleware for the Python API with HMAC authentication and rate limiting.
    """
    
    def __init__(self):
        # Validate HMAC secret is present and non-empty
        self.hmac_secret = os.getenv('HMAC_SHARED_SECRET')
        if not self.hmac_secret or not self.hmac_secret.strip():
            error_msg = "HMAC_SHARED_SECRET environment variable is required and must be a non-empty string"
            logger.critical(error_msg)
            raise ValueError(error_msg)
        

        self.nonce_expiry = 300  # 5 minutes
        self.rate_limit_requests = 15  # requests per window
        self.rate_limit_window = 60  # seconds
        self.request_timeout = 30  # seconds
        
        # Distributed rate limiting using pluggable cache (Redis in production, in-memory in dev)
        self.cache = cache
        self.rate_limit_prefix = "rate_limit:"
        
        # TODO: In production, ensure Redis is properly configured for distributed rate limiting
        # across multiple application instances. The in-memory fallback is only suitable for
        # single-instance development/testing environments.
        
        logger.info(f"Security middleware initialized - HMAC: SET")
        logger.info(f"Rate limiting cache: {type(self.cache).__name__}")
        
        # Log critical warning if using in-memory cache in production-like environment
        if os.getenv('PYTHON_ENV', 'development').lower() not in ['development', 'dev', 'test']:
            if isinstance(self.cache, type(cache)) and 'InMemoryCache' in str(type(self.cache)):
                logger.critical(
                    "WARNING: Using in-memory rate limiting in production environment! "
                    "This will not work correctly with multiple application instances. "
                    "Configure REDIS_URL environment variable for distributed rate limiting."
                )
    

    
    def validate_hmac_signature(self, request_body: str, headers: Dict[str, str]) -> bool:
        """
        Validate HMAC signature for request authentication.
        """
        logger.info(f"Starting HMAC validation with request_body: '{request_body}'")
        
        # Extract required headers (case-insensitive)
        signature = headers.get('X-Request-Signature') or headers.get('x-request-signature')
        timestamp = headers.get('X-Request-Timestamp') or headers.get('x-request-timestamp')
        nonce = headers.get('X-Request-Nonce') or headers.get('x-request-nonce')
        
        logger.info(f"Extracted headers - signature: {signature}, timestamp: {timestamp}, nonce: {nonce}")
        
        if not all([signature, timestamp, nonce]):
            logger.warning("Missing required security headers")
            return False
        
        # Validate timestamp (within 5 minutes)
        try:
            timestamp_int = int(timestamp)
            current_time = int(time.time())
            if abs(current_time - timestamp_int) > self.nonce_expiry:
                logger.warning(f"Request timestamp expired: {timestamp_int}, current: {current_time}")
                return False
        except (ValueError, TypeError):
            logger.warning(f"Invalid timestamp format: {timestamp}")
            return False
        
        # Validate nonce format (alphanumeric, 16-64 chars)
        if not re.match(r'^[a-zA-Z0-9]{16,64}$', nonce):
            logger.warning(f"Invalid nonce format: {nonce}")
            return False
        
        # Recreate signature
        expected_signature = self._create_signature(request_body, timestamp, nonce)
        
        # Debug logging to see what's happening
        logger.info(f"HMAC validation debug:")
        logger.info(f"  Received signature: {signature}")
        logger.info(f"  Expected signature: {expected_signature}")
        logger.info(f"  HMAC secret length: {len(self.hmac_secret)}")
        logger.info(f"  HMAC secret first 10 chars: {self.hmac_secret[:10]}...")
        logger.info(f"  Request body: '{request_body}'")
        logger.info(f"  Timestamp: {timestamp}")
        logger.info(f"  Nonce: {nonce}")
        logger.info(f"  Payload: '{request_body}{timestamp}{nonce}'")
        
        # Compare signatures (constant-time comparison)
        if not hmac.compare_digest(signature, expected_signature):
            logger.warning("HMAC signature validation failed")
            return False
        
        return True
    
    def _create_signature(self, body: str, timestamp: str, nonce: str) -> str:
        """
        Create HMAC signature for request validation.
        """
        # Create signature payload: body + timestamp + nonce
        payload = f"{body}{timestamp}{nonce}"
        
        # Create HMAC signature
        signature = hmac.new(
            self.hmac_secret.encode('utf-8'),
            payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        return signature
    
    def validate_idempotency(self, idempotency_key: str) -> bool:
        """
        Validate idempotency key format and uniqueness.
        """
        if not idempotency_key:
            logger.warning("Missing idempotency key")
            return False
        
        # Validate format (alphanumeric with hyphens, common format: timestamp-random)
        if not re.match(r'^[a-zA-Z0-9\-]{16,64}$', idempotency_key):
            logger.warning(f"Invalid idempotency key format: {idempotency_key}")
            return False
        
        # TODO: In production, check against database/storage for uniqueness
        # For now, we'll just validate format
        return True
    
    def check_rate_limit(self, client_ip: str) -> bool:
        """
        Check rate limiting for client IP using distributed cache.
        """
        current_time = int(time.time())
        window_start = current_time - self.rate_limit_window
        cache_key = f"{self.rate_limit_prefix}{client_ip}"
        
        try:
            # Get existing timestamps for this IP
            timestamps = self.cache.list_get(cache_key)
            timestamps = [int(ts) for ts in timestamps if ts.isdigit()]
            
            # Filter out old entries (outside the current window)
            valid_timestamps = [ts for ts in timestamps if ts > window_start]
            
            # Check if limit exceeded
            if len(valid_timestamps) >= self.rate_limit_requests:
                logger.warning(f"Rate limit exceeded for IP: {client_ip}")
                return False
            
            # Add current request timestamp
            valid_timestamps.append(current_time)
            
            # Update cache with new timestamps and set TTL
            # Use pipeline-like approach for better performance
            self.cache.delete(cache_key)  # Clear existing list
            for ts in valid_timestamps:
                self.cache.list_append(cache_key, str(ts))
            
            # Set TTL to ensure cleanup (window duration + buffer)
            self.cache.set(f"{cache_key}:ttl", "1", ttl=self.rate_limit_window + 60)
            
            return True
            
        except Exception as e:
            logger.error(f"Rate limiting cache error for IP {client_ip}: {e}")
            # On cache failure, allow the request but log the error
            # This prevents cache issues from breaking the application
            logger.warning(f"Rate limiting failed, allowing request for IP {client_ip} due to cache error")
            return True
    
    def get_client_ip(self, headers: Dict[str, str]) -> str:
        """
        Extract client IP from headers, handling proxy scenarios.
        """
        # Check for Cloudflare headers first
        cf_connecting_ip = headers.get('CF-Connecting-IP')
        if cf_connecting_ip:
            return cf_connecting_ip
        
        # Check for X-Forwarded-For
        x_forwarded_for = headers.get('X-Forwarded-For')
        if x_forwarded_for:
            # Take the first IP in the chain
            return x_forwarded_for.split(',')[0].strip()
        
        # Fallback to X-Real-IP
        x_real_ip = headers.get('X-Real-IP')
        if x_real_ip:
            return x_real_ip
        
        # Default fallback
        return 'unknown'
    
    def validate_request(self, method: str, path: str, headers: Dict[str, str], body: str = '') -> Tuple[bool, str, Dict[str, str]]:
        """
        Comprehensive request validation.
        Returns: (is_valid, error_message, cors_headers)
        """
        # Extract client IP
        client_ip = self.get_client_ip(headers)
        
        # Rate limiting
        if not self.check_rate_limit(client_ip):
            return False, "Rate limit exceeded", {}
        
        # HMAC validation (skip for OPTIONS requests)
        if method != 'OPTIONS':
            if not self.validate_hmac_signature(body, headers):
                return False, "HMAC validation failed", {}
            
            # Idempotency validation for state-changing operations
            if method == 'POST':
                idempotency_key = headers.get('X-Idempotency-Key') or headers.get('x-idempotency-key')
                if not self.validate_idempotency(idempotency_key):
                    return False, "Invalid idempotency key", {}
        
        # No CORS headers needed - HMAC authentication is sufficient
        return True, "", {}
    
    def create_signature_for_response(self, body: str, timestamp: str, nonce: str) -> str:
        """
        Create HMAC signature for response validation (if needed).
        """
        return self._create_signature(body, timestamp, nonce)

# Global security middleware instance
security_middleware = SecurityMiddleware()
