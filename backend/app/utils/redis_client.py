import time
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)

# In-memory fallback if Redis is unavailable
_memory_otp_cache: Dict[str, dict] = {}

_redis_client = None

def get_redis_client():
    global _redis_client
    if _redis_client is not None:
        return _redis_client

    try:
        import redis
        from app.config import REDIS_URL
        client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=2)
        client.ping()
        _redis_client = client
        logger.info(f"[Redis] Connected successfully to {REDIS_URL.split('@')[-1] if '@' in REDIS_URL else REDIS_URL}")
        return _redis_client
    except Exception as e:
        logger.warning(f"[Redis] Unable to connect to Redis ({e}). Using in-memory OTP fallback.")
        _redis_client = False
        return None

def is_redis_available() -> bool:
    client = get_redis_client()
    return bool(client)

def set_otp(email: str, otp: str, ttl_seconds: int = 600) -> bool:
    """Store 6-digit password reset OTP with TTL expiration."""
    clean_email = email.strip().lower()
    client = get_redis_client()
    if client:
        try:
            client.setex(f"otp:reset:{clean_email}", ttl_seconds, str(otp))
            return True
        except Exception as e:
            logger.error(f"[Redis] Error setting OTP for {clean_email}: {e}")

    # Fallback to in-memory store
    _memory_otp_cache[clean_email] = {
        "otp": str(otp),
        "expires_at": time.time() + ttl_seconds
    }
    return True

def get_otp(email: str) -> Optional[str]:
    """Retrieve active password reset OTP if not expired."""
    clean_email = email.strip().lower()
    client = get_redis_client()
    if client:
        try:
            val = client.get(f"otp:reset:{clean_email}")
            if val:
                return str(val)
        except Exception as e:
            logger.error(f"[Redis] Error getting OTP for {clean_email}: {e}")

    # Fallback check in memory
    item = _memory_otp_cache.get(clean_email)
    if item:
        if time.time() <= item["expires_at"]:
            return item["otp"]
        else:
            del _memory_otp_cache[clean_email]
    return None

def delete_otp(email: str) -> bool:
    """Delete OTP upon successful password reset."""
    clean_email = email.strip().lower()
    client = get_redis_client()
    if client:
        try:
            client.delete(f"otp:reset:{clean_email}")
        except Exception as e:
            logger.error(f"[Redis] Error deleting OTP for {clean_email}: {e}")

    if clean_email in _memory_otp_cache:
        del _memory_otp_cache[clean_email]
    return True
