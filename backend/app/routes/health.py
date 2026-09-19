import logging
from datetime import datetime, timezone
from fastapi import APIRouter
from sqlalchemy import text
from app.database import engine
from app.utils.redis_client import test_redis_connection
from app.utils.email_service import get_smtp_status

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Health"])

def get_health_status():
    db_status = "connected"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = f"error: {str(e)}"

    redis_info = test_redis_connection()
    smtp_info = get_smtp_status()

    is_healthy = (db_status == "connected")

    return {
        "status": "healthy" if is_healthy else "degraded",
        "service": "Smart Attend FastAPI Backend",
        "version": "2.0.0",
        "database": db_status,
        "redis": redis_info,
        "smtp": smtp_info,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/health")
def root_health():
    return get_health_status()

@router.get("/api/health")
def api_health():
    return get_health_status()

