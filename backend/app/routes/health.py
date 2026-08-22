from fastapi import APIRouter
from datetime import datetime

router = APIRouter(prefix="/api/health", tags=["Health"])

@router.get("")
def health_check():
    return {
        "status": "online",
        "service": "Smart Attend FastAPI Backend",
        "version": "2.0.0",
        "timestamp": datetime.utcnow().isoformat() + "Z"
    }
