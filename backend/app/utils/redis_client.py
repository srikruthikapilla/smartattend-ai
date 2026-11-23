import time
import logging
import threading
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)

# In-memory fallback if Redis is unavailable, protected by lock
_memory_otp_cache: Dict[str, dict] = {}
_memory_lock = threading.Lock()

# Connection pool and client instances
_redis_pool = None
_redis_client = None
_client_lock = threading.Lock()

# Failure backoff cooldown state
_last_failure_time: float = 0.0


def mark_redis_failure(exc: Optional[Exception] = None) -> None:
    """Trigger cooldown backoff upon runtime Redis connection/timeout error."""
    global _redis_client, _redis_pool, _last_failure_time
    from app.config import REDIS_COOLDOWN_SECONDS
    with _client_lock:
        _last_failure_time = time.time()
        _redis_client = None
        if _redis_pool is not None:
            try:
                _redis_pool.disconnect()
            except Exception:
                pass
            _redis_pool = None
    if exc:
        logger.warning(
            f"[Redis] Runtime connection failure ({exc}). Initiating {REDIS_COOLDOWN_SECONDS}s cooldown backoff."
        )


def get_redis_client():
    """
    Return a connected Redis client with thread-safe connection pooling,
    or None if unavailable or in failure cooldown backoff.

    Resilience guarantees:
    - Thread-safe singleton creation via threading.Lock().
    - Thread-safe connection pooling (redis.ConnectionPool, max_connections=50).
    - Failure backoff cooldown (e.g. 15s) so failed connections don't block
      subsequent requests or freeze the asyncio event loop with synchronous socket timeouts.
    - Fast fail without blocking sockets while cooldown is active.
    """
    global _redis_client, _redis_pool, _last_failure_time
    from app.config import (
        REDIS_URL,
        REDIS_MAX_CONNECTIONS,
        REDIS_SOCKET_TIMEOUT,
        REDIS_CONNECT_TIMEOUT,
        REDIS_COOLDOWN_SECONDS,
    )

    # Fast path 1: active client already initialized
    if _redis_client is not None:
        return _redis_client

    # Fast path 2: within failure cooldown period - immediately return None without blocking
    now = time.time()
    if _last_failure_time > 0 and (now - _last_failure_time) < REDIS_COOLDOWN_SECONDS:
        return None

    with _client_lock:
        # Double-check inside lock
        if _redis_client is not None:
            return _redis_client

        now = time.time()
        if _last_failure_time > 0 and (now - _last_failure_time) < REDIS_COOLDOWN_SECONDS:
            return None

        try:
            import redis
            import urllib.parse

            ssl_kwargs = {}
            if REDIS_URL.startswith("rediss://"):
                import ssl
                ssl_kwargs["ssl_cert_reqs"] = ssl.CERT_REQUIRED

            pool = redis.ConnectionPool.from_url(
                REDIS_URL,
                max_connections=REDIS_MAX_CONNECTIONS,
                socket_connect_timeout=REDIS_CONNECT_TIMEOUT,
                socket_timeout=REDIS_SOCKET_TIMEOUT,
                socket_keepalive=True,
                health_check_interval=30,
                decode_responses=True,
                retry_on_timeout=True,
                **ssl_kwargs
            )
            client = redis.Redis(connection_pool=pool)
            client.ping()

            _redis_pool = pool
            _redis_client = client
            _last_failure_time = 0.0

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

            logger.info(f"[Redis] Connected successfully to {masked_endpoint} (pool max_conn={REDIS_MAX_CONNECTIONS})")
            return _redis_client
        except Exception as e:
            _last_failure_time = time.time()
            _redis_client = None
            if _redis_pool is not None:
                try:
                    _redis_pool.disconnect()
                except Exception:
                    pass
                _redis_pool = None
            logger.warning(
                f"[Redis] Unable to connect to Redis ({e}). Cooldown {REDIS_COOLDOWN_SECONDS}s active; using in-memory fallback cache."
            )
            return None


def is_redis_available() -> bool:
    """Non-blocking check if Redis is available and not in cooldown."""
    from app.config import REDIS_COOLDOWN_SECONDS
    now = time.time()
    if _last_failure_time > 0 and (now - _last_failure_time) < REDIS_COOLDOWN_SECONDS:
        return False
    client = get_redis_client()
    return bool(client)


def set_otp(email: str, otp: str, ttl_seconds: int = 600) -> bool:
    """Store 6-digit password reset / enrollment OTP with TTL expiration."""
    clean_email = email.strip().lower()
    client = get_redis_client()
    if client:
        try:
            client.setex(f"otp:reset:{clean_email}", ttl_seconds, str(otp))
            with _memory_lock:
                _memory_otp_cache.pop(clean_email, None)
            return True
        except Exception as e:
            logger.error(f"[Redis] Error setting OTP for {clean_email}: {e}")
            mark_redis_failure(e)

    # Fallback to in-memory store
    with _memory_lock:
        from app.config import IS_PRODUCTION
        if IS_PRODUCTION:
            logger.error("[Redis] OTP storage unavailable in production; refusing process-local fallback.")
            return False
        _memory_otp_cache[clean_email] = {
            "otp": str(otp),
            "expires_at": time.time() + ttl_seconds
        }
    return True


def get_otp(email: str) -> Optional[str]:
    """Retrieve active password reset / enrollment OTP if not expired."""
    clean_email = email.strip().lower()
    client = get_redis_client()
    if client:
        try:
            val = client.get(f"otp:reset:{clean_email}")
            if val:
                return str(val)
        except Exception as e:
            logger.error(f"[Redis] Error getting OTP for {clean_email}: {e}")
            mark_redis_failure(e)
        else:
            # Redis is authoritative while connected; do not resurrect stale
            # process-local values after a Redis restart or failover.
            return None

    # Fallback check in memory
    with _memory_lock:
        item = _memory_otp_cache.get(clean_email)
        if item:
            if time.time() <= item["expires_at"]:
                return item["otp"]
            else:
                del _memory_otp_cache[clean_email]
    return None


def delete_otp(email: str) -> bool:
    """Delete OTP upon successful verification / reset."""
    clean_email = email.strip().lower()
    client = get_redis_client()
    if client:
        try:
            client.delete(f"otp:reset:{clean_email}")
        except Exception as e:
            logger.error(f"[Redis] Error deleting OTP for {clean_email}: {e}")
            mark_redis_failure(e)

    with _memory_lock:
        _memory_otp_cache.pop(clean_email, None)
    return True


def consume_otp(key: str, expected: Optional[str] = None) -> Optional[str]:
    """Atomically consume a one-time challenge, optionally only when it matches."""
    clean_key = key.strip().lower()
    client = get_redis_client()
    if client:
        try:
            redis_key = f"otp:reset:{clean_key}"
            if expected is None:
                value = client.getdel(redis_key)
                return str(value) if value is not None else None
            script = "local v=redis.call('GET',KEYS[1]); if v and v==ARGV[1] then redis.call('DEL',KEYS[1]); return v end return nil"
            value = client.eval(script, 1, redis_key, str(expected))
            return str(value) if value is not None else None
        except Exception as e:
            logger.error(f"[Redis] Error consuming OTP for {clean_key}: {e}")
            mark_redis_failure(e)
        else:
            # Redis is authoritative while connected; never resurrect stale local OTPs.
            return None

    with _memory_lock:
        item = _memory_otp_cache.get(clean_key)
        if item and time.time() <= item["expires_at"] and (expected is None or str(item["otp"]) == str(expected)):
            _memory_otp_cache.pop(clean_key, None)
            return item["otp"]
    return None

def claim_once(key: str, ttl_seconds: int = 1800) -> Optional[bool]:
    """Atomically claim a one-time marker; returns False when already claimed."""
    clean_key = key.strip().lower()
    client = get_redis_client()
    if client:
        try:
            return bool(client.set(f"otp:reset:{clean_key}", "1", ex=ttl_seconds, nx=True))
        except Exception as e:
            mark_redis_failure(e)
    from app.config import IS_PRODUCTION
    if IS_PRODUCTION:
        return None
    with _memory_lock:
        item = _memory_otp_cache.get(clean_key)
        if item and time.time() <= item["expires_at"]:
            return False
        _memory_otp_cache[clean_key] = {"otp": "1", "expires_at": time.time() + ttl_seconds}
        return True


def test_redis_connection() -> Dict[str, Any]:
    """
    Test active Redis connectivity and return latency and status details.
    Safely masks passwords and reports in-memory fallback status if disconnected.
    """
    from app.config import (
        REDIS_URL,
        REDIS_MAX_CONNECTIONS,
        REDIS_COOLDOWN_SECONDS,
    )
    import urllib.parse

    masked_endpoint = REDIS_URL
    try:
        parsed = urllib.parse.urlparse(REDIS_URL)
        if parsed.password:
            masked_netloc = parsed.netloc.replace(parsed.password, "******")
            masked_endpoint = urllib.parse.urlunparse(parsed._replace(netloc=masked_netloc))
    except Exception:
        masked_endpoint = "redis://[configured]"

    now = time.time()
    cooldown_remaining = max(0.0, round(REDIS_COOLDOWN_SECONDS - (now - _last_failure_time), 1)) if _last_failure_time > 0 and (now - _last_failure_time) < REDIS_COOLDOWN_SECONDS else 0.0

    with _memory_lock:
        active_memory_keys = len(_memory_otp_cache)

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
                "max_connections": REDIS_MAX_CONNECTIONS,
                "cooldown_active": False,
                "cooldown_remaining_seconds": 0.0,
                "memory_fallback_active": False,
                "active_memory_keys": active_memory_keys
            }
    except Exception as e:
        mark_redis_failure(e)
        return {
            "connected": False,
            "status": "disconnected",
            "endpoint": masked_endpoint,
            "error": str(e),
            "max_connections": REDIS_MAX_CONNECTIONS,
            "cooldown_active": True,
            "cooldown_remaining_seconds": REDIS_COOLDOWN_SECONDS,
            "memory_fallback_active": True,
            "active_memory_keys": active_memory_keys
        }

    return {
        "connected": False,
        "status": "disconnected",
        "endpoint": masked_endpoint,
        "error": f"Redis in failure cooldown ({cooldown_remaining}s remaining)" if cooldown_remaining > 0 else "Redis client returned None (in-memory mode)",
        "max_connections": REDIS_MAX_CONNECTIONS,
        "cooldown_active": cooldown_remaining > 0,
        "cooldown_remaining_seconds": cooldown_remaining,
        "memory_fallback_active": True,
        "active_memory_keys": active_memory_keys
    }
