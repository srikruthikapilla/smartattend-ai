import time
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# In-memory fallback if Redis is unavailable
_memory_otp_cache: Dict[str, dict] = {}

# None = not yet attempted; False = permanently failed; object = connected client
_redis_client = None


def get_redis_client():
    """
    Return a connected Redis client, or None if unavailable.

    Uses a lazy-init singleton with retry semantics:
    - First call attempts connection.
    - On failure, _redis_client is reset to None so the next call retries.
      (Previous bug: set to False, blocking all future retry attempts.)
    """
    global _redis_client

    # If we already have a live client, return it
    if _redis_client is not None and _redis_client is not False:
        return _redis_client

    try:
        import redis
        from app.config import REDIS_URL
        import urllib.parse

        ssl_kwargs = {}
        if REDIS_URL.startswith("rediss://"):
            import ssl
            ssl_kwargs["ssl_cert_reqs"] = None

        client = redis.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
            socket_timeout=5,
            retry_on_timeout=True,
            **ssl_kwargs
        )
        client.ping()
        _redis_client = client

        # Log masked URL (hides credentials)
        try:
            parsed = urllib.parse.urlparse(REDIS_URL)
            if parsed.password:
                masked_netloc = parsed.netloc.replace(parsed.password, "******")
                masked_endpoint = urllib.parse.urlunparse(parsed._replace(netloc=masked_netloc))
            else:
                masked_endpoint = REDIS_URL
        except Exception:
            masked_endpoint = "redis://[configured]"

        logger.info(f"[Redis] Connected successfully to {masked_endpoint}")
        return _redis_client
    except Exception as e:
        logger.warning(f"[Redis] Unable to connect to Redis ({e}). Using in-memory fallback cache.")
        # Reset to None (not False) so the next call retries after Redis recovers
        _redis_client = None
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


def test_redis_connection() -> Dict[str, Any]:
    """
    Test active Redis connectivity and return latency and status details.
    Safely masks passwords and reports in-memory fallback status if disconnected.
    """
    from app.config import REDIS_URL
    import urllib.parse

    masked_endpoint = REDIS_URL
    try:
        parsed = urllib.parse.urlparse(REDIS_URL)
        if parsed.password:
            masked_netloc = parsed.netloc.replace(parsed.password, "******")
            masked_endpoint = urllib.parse.urlunparse(parsed._replace(netloc=masked_netloc))
    except Exception:
        masked_endpoint = "redis://[configured]"

    t0 = time.perf_counter()
    try:
        client = get_redis_client()
        if client:
            client.ping()
            latency_ms = round((time.perf_counter() - t0) * 1000, 2)
            return {
                "connected": True,
                "status": "connected",
                "endpoint": masked_endpoint,
                "latency_ms": latency_ms,
                "memory_fallback_active": False,
                "active_memory_keys": len(_memory_otp_cache)
            }
    except Exception as e:
        return {
            "connected": False,
            "status": "disconnected",
            "endpoint": masked_endpoint,
            "error": str(e),
            "memory_fallback_active": True,
            "active_memory_keys": len(_memory_otp_cache)
        }

    return {
        "connected": False,
        "status": "disconnected",
        "endpoint": masked_endpoint,
        "error": "Redis client returned None (in-memory mode)",
        "memory_fallback_active": True,
        "active_memory_keys": len(_memory_otp_cache)
    }

