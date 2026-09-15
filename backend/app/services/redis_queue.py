"""
Smart Attend — High-Performance Redis Background Queue & Caching Service
========================================================================
Decouples latency-critical check-in API endpoints by:
1. Asynchronously queueing audit logs to PostgreSQL.
2. Non-blocking Socket.io event broadcasting.
3. 60-second Redis caching for student enrollment status lookups with automatic invalidation.
"""

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from app.utils.redis_client import get_redis_client

logger = logging.getLogger(__name__)

REDIS_QUEUE_KEY = "smartattend:queue:bg_tasks"
STUDENT_CACHE_PREFIX = "student:status:"

# In-memory async fallback queue
_local_task_queue: asyncio.Queue = asyncio.Queue()
_worker_running: bool = False
_sio_ref = None


def set_queue_sio(sio):
    global _sio_ref
    _sio_ref = sio


# ---------------------------------------------------------------------------
# Student Status Caching
# ---------------------------------------------------------------------------
def get_cached_student_status(hall_ticket: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached student enrollment status from Redis."""
    try:
        client = get_redis_client()
        if client:
            val = client.get(f"{STUDENT_CACHE_PREFIX}{hall_ticket.upper()}")
            if val:
                return json.loads(val)
    except Exception as e:
        logger.warning(f"[Redis Cache] Get status error for {hall_ticket}: {e}")
    return None


def set_cached_student_status(hall_ticket: str, data: Dict[str, Any], ttl: int = 60) -> None:
    """Store student status in Redis with a 60-second TTL."""
    try:
        client = get_redis_client()
        if client:
            client.setex(
                f"{STUDENT_CACHE_PREFIX}{hall_ticket.upper()}",
                ttl,
                json.dumps(data)
            )
    except Exception as e:
        logger.warning(f"[Redis Cache] Set status error for {hall_ticket}: {e}")


def invalidate_student_cache(hall_ticket: str) -> None:
    """Invalidate student status cache immediately when state changes."""
    try:
        client = get_redis_client()
        if client:
            client.delete(f"{STUDENT_CACHE_PREFIX}{hall_ticket.upper()}")
            logger.info(f"[Redis Cache] Invalidated cache for {hall_ticket}")
    except Exception as e:
        logger.warning(f"[Redis Cache] Invalidate error for {hall_ticket}: {e}")


# ---------------------------------------------------------------------------
# Task Enqueueing
# ---------------------------------------------------------------------------
def enqueue_task(task_type: str, payload: Dict[str, Any]) -> None:
    """
    Enqueue a background task into Redis list with local asyncio.Queue fallback.
    """
    message = {
        "type": task_type,
        "payload": payload,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    queued_to_redis = False
    try:
        client = get_redis_client()
        if client:
            client.rpush(REDIS_QUEUE_KEY, json.dumps(message))
            queued_to_redis = True
    except Exception as e:
        logger.warning(f"[Queue] Redis rpush error: {e}")

    # Also put in local async queue if not in Redis or for immediate event-loop consumption
    try:
        _local_task_queue.put_nowait(message)
    except Exception:
        pass


def enqueue_audit_log(
    action: str,
    performed_by: str,
    performer_role: str = "student",
    details: Optional[Dict[str, Any]] = None
) -> None:
    """Non-blocking queueing of security audit events to PostgreSQL."""
    enqueue_task("audit_log", {
        "action": action,
        "performed_by": performed_by,
        "performer_role": performer_role,
        "details": details or {}
    })


def enqueue_socketio_broadcast(event: str, data: Dict[str, Any]) -> None:
    """Non-blocking queueing of Socket.io event emissions."""
    enqueue_task("socketio_broadcast", {
        "event": event,
        "data": data
    })


# ---------------------------------------------------------------------------
# Background Worker
# ---------------------------------------------------------------------------
async def _process_task(task: Dict[str, Any]):
    task_type = task.get("type")
    payload = task.get("payload", {})

    if task_type == "audit_log":
        try:
            from app.database import get_db_context
            from app.models.db_models import AuditLog
            with get_db_context() as db:
                log_entry = AuditLog(
                    action=payload.get("action", "unknown_action"),
                    performed_by=payload.get("performed_by", "system"),
                    performer_role=payload.get("performer_role", "system"),
                    details=payload.get("details", {})
                )
                db.add(log_entry)
                db.commit()
        except Exception as e:
            logger.error(f"[Queue Worker] Audit log error: {e}")

    elif task_type == "socketio_broadcast":
        if _sio_ref:
            try:
                event = payload.get("event", "attendance:new")
                data = payload.get("data", {})
                await _sio_ref.emit(event, data)
            except Exception as e:
                logger.warning(f"[Queue Worker] Socket.io emit error: {e}")

    elif task_type == "cache_invalidate":
        ht = payload.get("hall_ticket")
        if ht:
            invalidate_student_cache(ht)


async def start_queue_worker(sio=None):
    """
    Background worker task started with FastAPI lifespan.
    Continuously drains tasks from Redis and local queues.
    """
    global _worker_running, _sio_ref
    if sio:
        _sio_ref = sio
    _worker_running = True
    logger.info("🚀 [Redis Queue] High-performance background task worker started.")

    while _worker_running:
        processed_any = False
        # 1. Drain Redis tasks if available
        try:
            client = get_redis_client()
            if client:
                raw_item = client.lpop(REDIS_QUEUE_KEY)
                if raw_item:
                    task = json.loads(raw_item)
                    await _process_task(task)
                    processed_any = True
        except Exception as e:
            logger.debug(f"[Queue Worker] Redis pop note: {e}")

        # 2. Drain local memory queue
        while not _local_task_queue.empty():
            try:
                local_task = _local_task_queue.get_nowait()
                # If already processed from Redis, skip duplicate execution
                if not processed_any:
                    await _process_task(local_task)
                _local_task_queue.task_done()
                processed_any = True
            except asyncio.QueueEmpty:
                break
            except Exception as e:
                logger.error(f"[Queue Worker] Local task error: {e}")

        if not processed_any:
            await asyncio.sleep(0.1)  # 100ms idle poll


def stop_queue_worker():
    global _worker_running
    _worker_running = False
    logger.info("🛑 [Redis Queue] Background worker stopped.")
