#!/usr/bin/env python3
"""
Test script for the distributed cache functionality.
This script tests both in-memory and Redis cache implementations.
"""

import os
import sys
import time
import logging
from typing import Optional

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from cache import create_cache, InMemoryCache, RedisCache, CacheInterface

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def test_cache_basic_operations(cache: CacheInterface, cache_name: str) -> bool:
    """Test basic cache operations."""
    logger.info(f"Testing basic operations for {cache_name}")
    
    try:
        # Test set/get
        cache.set("test_key", "test_value", ttl=10)
        value = cache.get("test_key")
        assert value == "test_value", f"Expected 'test_value', got '{value}'"
        logger.info("✓ Set/get test passed")
        
        # Test exists
        assert cache.exists("test_key"), "Key should exist"
        assert not cache.exists("nonexistent_key"), "Non-existent key should not exist"
        logger.info("✓ Exists test passed")
        
        # Test delete
        assert cache.delete("test_key"), "Delete should return True"
        assert not cache.exists("test_key"), "Key should not exist after delete"
        logger.info("✓ Delete test passed")
        
        # Test TTL
        cache.set("ttl_key", "ttl_value", ttl=1)
        time.sleep(0.5)  # Wait half the TTL
        assert cache.exists("ttl_key"), "Key should still exist"
        time.sleep(0.6)  # Wait for TTL to expire
        assert not cache.exists("ttl_key"), "Key should expire after TTL"
        logger.info("✓ TTL test passed")
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Basic operations test failed for {cache_name}: {e}")
        return False

def test_cache_list_operations(cache: CacheInterface, cache_name: str) -> bool:
    """Test list operations."""
    logger.info(f"Testing list operations for {cache_name}")
    
    try:
        key = "test_list"
        
        # Test list append
        cache.list_append(key, "item1")
        cache.list_append(key, "item2")
        cache.list_append(key, "item3")
        
        # Test list get
        items = cache.list_get(key)
        assert items == ["item1", "item2", "item3"], f"Expected ['item1', 'item2', 'item3'], got {items}"
        logger.info("✓ List append/get test passed")
        
        # Test list trim
        cache.list_trim(key, 0, 1)  # Keep only first 2 items
        items = cache.list_get(key)
        assert items == ["item1", "item2"], f"Expected ['item1', 'item2'], got {items}"
        logger.info("✓ List trim test passed")
        
        # Cleanup
        cache.delete(key)
        
        return True
        
    except Exception as e:
        logger.error(f"✗ List operations test failed for {cache_name}: {e}")
        return False

def test_rate_limiting_simulation(cache: CacheInterface, cache_name: str) -> bool:
    """Simulate rate limiting operations."""
    logger.info(f"Testing rate limiting simulation for {cache_name}")
    
    try:
        client_ip = "192.168.1.1"
        cache_key = f"rate_limit:{client_ip}"
        current_time = int(time.time())
        
        # Simulate rate limiting window (60 seconds, 10 requests max)
        window_start = current_time - 60
        
        # Add some old timestamps (should be filtered out)
        old_timestamps = [window_start - 10, window_start - 5]
        for ts in old_timestamps:
            cache.list_append(cache_key, str(ts))
        
        # Add recent timestamps
        recent_timestamps = [current_time - 30, current_time - 20, current_time - 10]
        for ts in recent_timestamps:
            cache.list_append(cache_key, str(ts))
        
        # Get all timestamps
        all_timestamps = cache.list_get(cache_key)
        all_timestamps = [int(ts) for ts in all_timestamps if ts.isdigit()]
        
        # Filter out old entries
        valid_timestamps = [ts for ts in all_timestamps if ts > window_start]
        
        assert len(valid_timestamps) == 3, f"Expected 3 valid timestamps, got {len(valid_timestamps)}"
        assert all(ts > window_start for ts in valid_timestamps), "All timestamps should be within window"
        
        logger.info("✓ Rate limiting simulation test passed")
        
        # Cleanup
        cache.delete(cache_key)
        
        return True
        
    except Exception as e:
        logger.error(f"✗ Rate limiting simulation test failed for {cache_name}: {e}")
        return False

def test_health_check(cache: CacheInterface, cache_name: str) -> bool:
    """Test health check functionality."""
    logger.info(f"Testing health check for {cache_name}")
    
    try:
        is_healthy = cache.health_check()
        assert is_healthy, f"Health check should return True for {cache_name}"
        logger.info("✓ Health check test passed")
        return True
        
    except Exception as e:
        logger.error(f"✗ Health check test failed for {cache_name}: {e}")
        return False

def main():
    """Run all cache tests."""
    logger.info("Starting cache functionality tests")
    
    # Test in-memory cache
    logger.info("\n" + "="*50)
    logger.info("Testing InMemoryCache")
    logger.info("="*50)
    
    in_memory_cache = InMemoryCache()
    in_memory_tests = [
        test_cache_basic_operations(in_memory_cache, "InMemoryCache"),
        test_cache_list_operations(in_memory_cache, "InMemoryCache"),
        test_rate_limiting_simulation(in_memory_cache, "InMemoryCache"),
        test_health_check(in_memory_cache, "InMemoryCache")
    ]
    
    # Test factory function
    logger.info("\n" + "="*50)
    logger.info("Testing cache factory function")
    logger.info("="*50)
    
    try:
        factory_cache = create_cache()
        factory_cache_name = type(factory_cache).__name__
        logger.info(f"Factory created: {factory_cache_name}")
        
        factory_tests = [
            test_cache_basic_operations(factory_cache, factory_cache_name),
            test_cache_list_operations(factory_cache, factory_cache_name),
            test_rate_limiting_simulation(factory_cache, factory_cache_name),
            test_health_check(factory_cache, factory_cache_name)
        ]
        
        # Test Redis cache if REDIS_URL is available
        redis_url = os.getenv('REDIS_URL')
        if redis_url:
            logger.info("\n" + "="*50)
            logger.info("Testing RedisCache")
            logger.info("="*50)
            
            try:
                redis_cache = RedisCache(redis_url)
                redis_tests = [
                    test_cache_basic_operations(redis_cache, "RedisCache"),
                    test_cache_list_operations(redis_cache, "RedisCache"),
                    test_rate_limiting_simulation(redis_cache, "RedisCache"),
                    test_health_check(redis_cache, "RedisCache")
                ]
                
                all_tests = in_memory_tests + factory_tests + redis_tests
            except Exception as e:
                logger.warning(f"Redis cache test skipped: {e}")
                all_tests = in_memory_tests + factory_tests
        else:
            logger.info("REDIS_URL not set, skipping Redis cache tests")
            all_tests = in_memory_tests + factory_tests
            
    except Exception as e:
        logger.error(f"Factory cache test failed: {e}")
        all_tests = in_memory_tests
    
    # Summary
    logger.info("\n" + "="*50)
    logger.info("Test Summary")
    logger.info("="*50)
    
    passed = sum(all_tests)
    total = len(all_tests)
    
    logger.info(f"Tests passed: {passed}/{total}")
    
    if passed == total:
        logger.info("🎉 All cache tests passed!")
        return 0
    else:
        logger.error("❌ Some cache tests failed!")
        return 1

if __name__ == "__main__":
    sys.exit(main())
