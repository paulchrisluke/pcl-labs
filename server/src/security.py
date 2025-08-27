import os
import time
import hmac
import hashlib
import json
import logging
from typing import Dict, Optional, Tuple
from urllib.parse import urlparse
import re

logger = logging.getLogger(__name__)

class SecurityMiddleware:
    """
    Security middleware for the Python API with HMAC authentication, CORS, and rate limiting.
    """
    
    def __init__(self):
        self.hmac_secret = os.getenv('HMAC_SHARED_SECRET')
        self.workers_origin = os.getenv('WORKERS_ORIGIN', '*.workers.dev')
        self.nonce_expiry = 300  # 5 minutes
        self.rate_limit_requests = 10  # requests per window
        self.rate_limit_window = 60  # seconds
        self.request_timeout = 30  # seconds
        
        # In-memory rate limiting (for production, use Redis or similar)
        self.rate_limit_store = {}
        
        logger.info(f"Security middleware initialized - HMAC: {'SET' if self.hmac_secret else 'MISSING'}")
    
    def validate_cors(self, origin: str, method: str) -> bool:
        """
        Validate CORS policy - only allow Cloudflare Workers origins.
        """
        if not origin:
            logger.warning("No Origin header provided")
            return False
        
        # Allow requests from Cloudflare Workers domains
        if self.workers_origin == '*.workers.dev':
            if not origin.endswith('.workers.dev'):
                logger.warning(f"Invalid origin: {origin} - must end with .workers.dev")
                return False
        else:
            # Allow specific origin if configured
            if origin != self.workers_origin:
                logger.warning(f"Invalid origin: {origin} - expected {self.workers_origin}")
                return False
        
        # Allow only specific methods
        allowed_methods = ['GET', 'POST', 'OPTIONS']
        if method not in allowed_methods:
            logger.warning(f"Invalid method: {method} - allowed: {allowed_methods}")
            return False
        
        return True
    
    def validate_hmac_signature(self, request_body: str, headers: Dict[str, str]) -> bool:
        """
        Validate HMAC signature for request authentication.
        """
        if not self.hmac_secret:
            logger.error("HMAC secret not configured")
            return False
        
        # Extract required headers
        signature = headers.get('X-Request-Signature')
        timestamp = headers.get('X-Request-Timestamp')
        nonce = headers.get('X-Request-Nonce')
        
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
        
        # Validate format (alphanumeric, 16-64 chars)
        if not re.match(r'^[a-zA-Z0-9]{16,64}$', idempotency_key):
            logger.warning(f"Invalid idempotency key format: {idempotency_key}")
            return False
        
        # TODO: In production, check against database/storage for uniqueness
        # For now, we'll just validate format
        return True
    
    def check_rate_limit(self, client_ip: str) -> bool:
        """
        Check rate limiting for client IP.
        """
        current_time = int(time.time())
        window_start = current_time - self.rate_limit_window
        
        # Clean old entries
        if client_ip in self.rate_limit_store:
            self.rate_limit_store[client_ip] = [
                t for t in self.rate_limit_store[client_ip] 
                if t > window_start
            ]
        else:
            self.rate_limit_store[client_ip] = []
        
        # Check if limit exceeded
        if len(self.rate_limit_store[client_ip]) >= self.rate_limit_requests:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return False
        
        # Add current request
        self.rate_limit_store[client_ip].append(current_time)
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
        # Extract origin and client IP
        origin = headers.get('Origin', '')
        client_ip = self.get_client_ip(headers)
        
        # CORS validation
        if not self.validate_cors(origin, method):
            return False, "CORS validation failed", {}
        
        # Rate limiting
        if not self.check_rate_limit(client_ip):
            return False, "Rate limit exceeded", {}
        
        # HMAC validation (skip for OPTIONS requests)
        if method != 'OPTIONS':
            if not self.validate_hmac_signature(body, headers):
                return False, "HMAC validation failed", {}
            
            # Idempotency validation for state-changing operations
            if method == 'POST':
                idempotency_key = headers.get('X-Idempotency-Key')
                if not self.validate_idempotency(idempotency_key):
                    return False, "Invalid idempotency key", {}
        
        # Prepare CORS headers
        cors_headers = {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Request-Signature, X-Request-Timestamp, X-Request-Nonce, X-Idempotency-Key',
            'Access-Control-Max-Age': '86400',  # 24 hours
        }
        
        return True, "", cors_headers
    
    def create_signature_for_response(self, body: str, timestamp: str, nonce: str) -> str:
        """
        Create HMAC signature for response validation (if needed).
        """
        return self._create_signature(body, timestamp, nonce)

# Global security middleware instance
security_middleware = SecurityMiddleware()
