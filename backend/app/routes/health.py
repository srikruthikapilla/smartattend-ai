import logging
from datetime import datetime, timezone
from fastapi import APIRouter
from sqlalchemy import text
from app.database import engine

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

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": "Smart Attend FastAPI Backend",
        "version": "2.0.0",
        "database": db_status,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@router.get("/health")
def root_health():
    return get_health_status()

@router.get("/api/health")
def api_health():
    return get_health_status()
