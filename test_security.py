#!/usr/bin/env python3
"""
Security implementation test script.
Tests HMAC authentication, CORS, and rate limiting for the Python API.
"""

import os
import time
import hmac
import hashlib
import json
import requests
import secrets
import string
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables from .env file if it exists
load_dotenv()

def get_required_env_var(var_name: str, default: str = None) -> str:
    """Get a required environment variable or raise a clear error."""
    value = os.environ.get(var_name, default)
    
    if value is None:
        raise ValueError(
            f"Required environment variable '{var_name}' is not set. "
            f"Please set this variable in your environment or .env file. "
            f"In CI environments, this variable must be explicitly set."
        )
    
    return value

def get_optional_env_var(var_name: str, default: str) -> str:
    """Get an optional environment variable with a safe default."""
    return os.environ.get(var_name, default)

# Test configuration - read from environment variables
# For CI environments, these must be set explicitly
# For local development, safe defaults are provided
API_BASE_URL = get_required_env_var(
    "API_BASE_URL", 
    "https://pcl-labs-jdb2zhf13-pcl-labs.vercel.app/api/audio_processor"
)

HMAC_SECRET = get_required_env_var(
    "HMAC_SHARED_SECRET"  # Match the env.example naming
)

WORKERS_ORIGIN = get_required_env_var(
    "WORKERS_ORIGIN",
    "https://clip-recap-pipeline.paulchrisluke.workers.dev"
)

# No fallback - HMAC_SHARED_SECRET must be set in environment

def test_environment_variables():
    """Test that environment variables are being read correctly."""
    print("🔧 Testing environment variable configuration...")
    
    # Test that all required variables are set
    required_vars = {
        "API_BASE_URL": API_BASE_URL,
        "HMAC_SHARED_SECRET": HMAC_SECRET,
        "WORKERS_ORIGIN": WORKERS_ORIGIN
    }
    
    for var_name, value in required_vars.items():
        if not value:
            print(f"❌ {var_name} is not set")
            return False
        else:
            print(f"✅ {var_name}: {'SET' if var_name == 'HMAC_SHARED_SECRET' else value}")
    
    # No fallback validation needed - HMAC_SECRET must be set
    
    print("✅ Environment variables configured correctly")
    return True

def generate_nonce(length: int = 32) -> str:
    """Generate a random nonce for request signing."""
    # Use alphanumeric only to match Python server validation
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))

def generate_idempotency_key() -> str:
    """Generate an idempotency key for state-changing operations."""
    timestamp = str(int(time.time()))
    random_part = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{timestamp}-{random_part}"

def create_signature(body: str, timestamp: str, nonce: str) -> str:
    """Create HMAC signature for request authentication."""
    payload = f"{body}{timestamp}{nonce}"
    signature = hmac.new(
        HMAC_SECRET.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return signature

def create_security_headers(body: str = '') -> Dict[str, str]:
    """Create security headers for API requests."""
    timestamp = str(int(time.time()))
    nonce = generate_nonce()
    idempotency_key = generate_idempotency_key()
    signature = create_signature(body, timestamp, nonce)
    
    return {
        'X-Request-Signature': signature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
        'X-Idempotency-Key': idempotency_key,
        'Origin': WORKERS_ORIGIN,
        'Content-Type': 'application/json'
    }

def test_health_check():
    """Test health check endpoint with security headers."""
    print("🔍 Testing health check with security headers...")
    
    headers = create_security_headers()
    
    try:
        response = requests.get(f"{API_BASE_URL}", headers=headers, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
        if response.status_code == 200:
            print("✅ Health check passed with security headers")
            return True
        else:
            print(f"❌ Health check failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_health_check_without_security():
    """Test health check endpoint without security headers (should fail)."""
    print("\n🔍 Testing health check WITHOUT security headers (should fail)...")
    
    headers = {'Content-Type': 'application/json'}
    
    try:
        response = requests.get(f"{API_BASE_URL}", headers=headers, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
        if response.status_code == 401:
            print("✅ Security validation working - request rejected without headers")
            return True
        else:
            print(f"❌ Security validation failed - request should have been rejected")
            return False
            
    except Exception as e:
        print(f"❌ Health check error: {e}")
        return False

def test_invalid_origin():
    """Test with invalid origin (CORS removed - should pass with HMAC)."""
    print("\n🔍 Testing with invalid origin (CORS removed - should pass with HMAC)...")
    
    headers = create_security_headers()
    headers['Origin'] = 'https://malicious-site.com'
    
    try:
        response = requests.get(f"{API_BASE_URL}", headers=headers, timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
        if response.status_code == 200:
            print("✅ CORS validation removed - request passed with HMAC authentication")
            return True
        else:
            print(f"❌ Request failed despite CORS being removed")
            return False
            
    except Exception as e:
        print(f"❌ Invalid origin test error: {e}")
        return False

def test_clip_processing():
    """Test clip processing endpoint with security headers."""
    print("\n🔍 Testing clip processing with security headers...")
    
    test_data = {
        "clip_ids": ["test_clip_123"],
        "background": False
    }
    
    body = json.dumps(test_data)
    headers = create_security_headers(body)
    
    try:
        response = requests.post(f"{API_BASE_URL}/process-clips", 
                               headers=headers, 
                               data=body, 
                               timeout=30)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text[:200]}...")
        
        if response.status_code in [200, 400, 404]:  # Accept various valid responses
            print("✅ Clip processing security validation passed")
            return True
        else:
            print(f"❌ Clip processing failed: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Clip processing error: {e}")
        return False

def test_rate_limiting():
    """Test rate limiting by making multiple rapid requests."""
    print("\n🔍 Testing rate limiting...")
    
    success_count = 0
    rate_limited_count = 0
    
    for i in range(25):  # Make 25 requests rapidly to test the new 15 request limit
        try:
            # Generate fresh security headers for each request
            headers = create_security_headers()
            response = requests.get(f"{API_BASE_URL}", headers=headers, timeout=10)
            # Small delay to ensure unique timestamps
            time.sleep(0.1)
            if response.status_code == 200:
                success_count += 1
            elif response.status_code == 429:  # Rate limited
                rate_limited_count += 1
                print(f"Rate limited on request {i+1}")
            else:
                print(f"Unexpected status {response.status_code} on request {i+1}")
                print(f"Response: {response.text[:200]}...")
        except Exception as e:
            print(f"Request {i+1} error: {e}")
    
    print(f"Successful requests: {success_count}")
    print(f"Rate limited requests: {rate_limited_count}")
    
    if rate_limited_count > 0:
        print("✅ Rate limiting is working")
        return True
    else:
        print("❌ Rate limiting may not be working")
        return False

def main():
    """Run all security tests."""
    print("🧪 Security Implementation Test Suite")
    print("=" * 50)
    
    tests = [
        ("Environment Variables", test_environment_variables),
        ("Health Check with Security", test_health_check),
        ("Health Check without Security", test_health_check_without_security),
        ("Invalid Origin Test", test_invalid_origin),
        ("Clip Processing Security", test_clip_processing),
        ("Rate Limiting Test", test_rate_limiting),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n📋 Running: {test_name}")
        print("-" * 30)
        
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ Test failed with exception: {e}")
            results.append((test_name, False))
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 Test Results Summary")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status} - {test_name}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All security tests passed!")
    else:
        print("⚠️ Some security tests failed. Please review the implementation.")
    
    return passed == total

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
