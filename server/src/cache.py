import os
import time
import logging
from typing import Optional, List, Dict, Any
from abc import ABC, abstractmethod

logger = logging.getLogger(__name__)

class CacheInterface(ABC):
    """Abstract interface for cache implementations."""
    
    @abstractmethod
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        pass
    
    @abstractmethod
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """Set value in cache with optional TTL."""
        pass
    
    @abstractmethod
    def delete(self, key: str) -> bool:
        """Delete value from cache."""
        pass
    
    @abstractmethod
    def exists(self, key: str) -> bool:
        """Check if key exists in cache."""
        pass
    
    @abstractmethod
    def list_get(self, key: str) -> List[Any]:
        """Get list from cache."""
        pass
    
    @abstractmethod
    def list_append(self, key: str, value: Any) -> bool:
        """Append value to list in cache."""
        pass
    
    @abstractmethod
    def list_trim(self, key: str, start: int, end: int) -> bool:
        """Trim list in cache to specified range."""
        pass
    
    @abstractmethod
    def health_check(self) -> bool:
        """Check if cache is healthy and accessible."""
        pass

class InMemoryCache(CacheInterface):
    """In-memory cache implementation for development/testing."""
    
    def __init__(self):
        self._store: Dict[str, Any] = {}
        self._expiry: Dict[str, float] = {}
        logger.warning("Using in-memory cache - NOT suitable for production with multiple instances")
    
    def _cleanup_expired(self):
        """Remove expired entries."""
        current_time = time.time()
        expired_keys = [k for k, v in self._expiry.items() if v < current_time]
        for key in expired_keys:
            del self._store[key]
            del self._expiry[key]
    
    def get(self, key: str) -> Optional[Any]:
        self._cleanup_expired()
        if key in self._expiry and self._expiry[key] < time.time():
            del self._store[key]
            del self._expiry[key]
            return None
        return self._store.get(key)
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        self._store[key] = value
        if ttl:
            self._expiry[key] = time.time() + ttl
        return True
    
    def delete(self, key: str) -> bool:
        if key in self._store:
            del self._store[key]
            if key in self._expiry:
                del self._expiry[key]
            return True
        return False
    
    def exists(self, key: str) -> bool:
        self._cleanup_expired()
        return key in self._store
    
    def list_get(self, key: str) -> List[Any]:
        self._cleanup_expired()
        return self._store.get(key, [])
    
    def list_append(self, key: str, value: Any) -> bool:
        if key not in self._store:
            self._store[key] = []
        self._store[key].append(value)
        return True
    
    def list_trim(self, key: str, start: int, end: int) -> bool:
        if key in self._store and isinstance(self._store[key], list):
            # Redis LTRIM behavior: keep elements from start to end (inclusive)
            # end=-1 means keep until the end
            if end == -1:
                self._store[key] = self._store[key][start:]
            else:
                self._store[key] = self._store[key][start:end+1]
            return True
        return False
    
    def health_check(self) -> bool:
        return True

class RedisCache(CacheInterface):
    """Redis cache implementation for production."""
    
    def __init__(self, redis_url: str):
        try:
            import redis
            self.redis_client = redis.from_url(redis_url, decode_responses=True)
            # Test connection
            self.redis_client.ping()
            logger.info("Redis cache initialized successfully")
        except ImportError:
            raise ImportError("Redis package not installed. Run: pip install redis")
        except Exception as e:
            logger.error(f"Failed to initialize Redis cache: {e}")
            raise
    
    def get(self, key: str) -> Optional[Any]:
        try:
            value = self.redis_client.get(key)
            return value
        except Exception as e:
            logger.error(f"Redis get error for key {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        try:
            if ttl:
                return self.redis_client.setex(key, ttl, str(value))
            else:
                return self.redis_client.set(key, str(value))
        except Exception as e:
            logger.error(f"Redis set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        try:
            return bool(self.redis_client.delete(key))
        except Exception as e:
            logger.error(f"Redis delete error for key {key}: {e}")
            return False
    
    def exists(self, key: str) -> bool:
        try:
            return bool(self.redis_client.exists(key))
        except Exception as e:
            logger.error(f"Redis exists error for key {key}: {e}")
            return False
    
    def list_get(self, key: str) -> List[Any]:
        try:
            return self.redis_client.lrange(key, 0, -1)
        except Exception as e:
            logger.error(f"Redis list_get error for key {key}: {e}")
            return []
    
    def list_append(self, key: str, value: Any) -> bool:
        try:
            return bool(self.redis_client.rpush(key, str(value)))
        except Exception as e:
            logger.error(f"Redis list_append error for key {key}: {e}")
            return False
    
    def list_trim(self, key: str, start: int, end: int) -> bool:
        try:
            return bool(self.redis_client.ltrim(key, start, end))
        except Exception as e:
            logger.error(f"Redis list_trim error for key {key}: {e}")
            return False
    
    def health_check(self) -> bool:
        try:
            self.redis_client.ping()
            return True
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return False

def create_cache() -> CacheInterface:
    """
    Factory function to create appropriate cache implementation based on environment.
    
    Returns:
        CacheInterface: Redis cache in production, in-memory cache in development
        
    Raises:
        RuntimeError: If Redis is required but not available
    """
    development_mode = os.getenv('PYTHON_ENV', 'development').lower() in ['development', 'dev', 'test']
    redis_url = os.getenv('REDIS_URL')
    
    if development_mode:
        if redis_url:
            logger.info("Development mode with Redis URL provided - using Redis cache")
            try:
                return RedisCache(redis_url)
            except Exception as e:
                logger.warning(f"Failed to connect to Redis in development mode: {e}")
                logger.warning("Falling back to in-memory cache")
                return InMemoryCache()
        else:
            logger.info("Development mode without Redis URL - using in-memory cache")
            return InMemoryCache()
    else:
        # Production mode - Redis is required
        if not redis_url:
            error_msg = (
                "REDIS_URL environment variable is required for production. "
                "Rate limiting requires a distributed cache for multi-instance deployments. "
                "Set REDIS_URL or use PYTHON_ENV=development for local testing."
            )
            logger.critical(error_msg)
            raise RuntimeError(error_msg)
        
        try:
            return RedisCache(redis_url)
        except Exception as e:
            error_msg = f"Failed to initialize Redis cache in production: {e}"
            logger.critical(error_msg)
            raise RuntimeError(error_msg)

# Global cache instance
cache = create_cache()
