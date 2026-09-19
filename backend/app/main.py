import socketio
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import CORS_ORIGINS, NODE_ENV
from app.routes.health import router as health_router
from app.routes.student_face import router as student_face_router
from app.routes.qr_session import router as qr_session_router
from app.routes.checkin import router as checkin_router, set_sio_server
from app.routes.attendance import router as attendance_router, set_sio_server as set_attendance_sio
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router
from app.routes.webauthn import router as webauthn_router

# ---------------------------------------------------------------------------
# Rate Limiting (slowapi + Redis)
# ---------------------------------------------------------------------------
try:
    from slowapi import Limiter, _rate_limit_exceeded_handler
    from slowapi.util import get_remote_address
    from slowapi.errors import RateLimitExceeded
    from app.config import REDIS_URL

    limiter = Limiter(
        key_func=get_remote_address,
        storage_uri=REDIS_URL,
        swallow_errors=True,
        default_limits=[]
    )
    RATE_LIMITING_ENABLED = True
except Exception:
    limiter = None
    RATE_LIMITING_ENABLED = False

# ---------------------------------------------------------------------------
# Socket.io
# ---------------------------------------------------------------------------
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=CORS_ORIGINS if CORS_ORIGINS else ["http://localhost:3000", "http://localhost:5173"]
)

set_sio_server(sio)
set_attendance_sio(sio)

@sio.event
async def connect(sid, environ):
    print(f"🔌 WebSocket Client Connected: {sid}")

@sio.event
async def disconnect(sid):
    print(f"❌ WebSocket Client Disconnected: {sid}")

# ---------------------------------------------------------------------------
# FastAPI App — disable interactive docs in production
# ---------------------------------------------------------------------------
IS_PRODUCTION = NODE_ENV == "production"

fastapi_app = FastAPI(
    title="Smart Attend — Face & Biometric Attendance Backend",
    description="High-performance async FastAPI backend with native NumPy face embedding matching and real-time WebSockets.",
    version="2.0.0",
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)

if RATE_LIMITING_ENABLED:
    fastapi_app.state.limiter = limiter
    fastapi_app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@fastapi_app.on_event("startup")
async def startup_event():
    """
    Application startup:
    1. Initialize PostgreSQL — verify connection, create tables, seed geofence & bootstrap admin.
    2. Pre-load all enrolled face embeddings from PostgreSQL into the in-memory
       vectorized matching registry.
    """
    from app.database import init_db, get_db_context
    from app.models.db_models import Student

    # Step 1: PostgreSQL init + admin bootstrap
    init_db()

    # Step 2: Pre-load face embeddings from PostgreSQL
    try:
        from app.services.face_recognition_service import face_service
        with get_db_context() as db:
            enrolled_students = (
                db.query(Student)
                .filter(Student.face_enrollment_status == "enrolled")
                .filter(Student.face_descriptor.isnot(None))
                .all()
            )
            loaded = 0
            for u in enrolled_students:
                ht = u.hall_ticket_no
                desc = u.face_descriptor
                if ht and desc and isinstance(desc, list) and len(desc) in (128, 512):
                    face_service.register_embedding(
                        hall_ticket=ht,
                        vector=desc,
                        name=u.name,
                        student_id=str(u.id)
                    )
                    loaded += 1
            print(f"🚀 [Face AI] Preloaded {loaded} active face vector embeddings from PostgreSQL.")
    except Exception as e:
        print(f"⚠️ [Face AI] Preload note: {e}")

    # Step 3: Start Redis high-performance background queue worker
    try:
        import asyncio
        from app.services.redis_queue import start_queue_worker
        asyncio.create_task(start_queue_worker(sio))
    except Exception as e:
        print(f"⚠️ [Redis Queue] Worker startup note: {e}")


@fastapi_app.on_event("shutdown")
async def shutdown_event():
    from app.services.redis_queue import stop_queue_worker
    stop_queue_worker()

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
fastapi_app.include_router(health_router)
fastapi_app.include_router(student_face_router)
fastapi_app.include_router(qr_session_router)
fastapi_app.include_router(checkin_router)
fastapi_app.include_router(attendance_router)
fastapi_app.include_router(admin_router)
fastapi_app.include_router(auth_router)
fastapi_app.include_router(webauthn_router)

# ---------------------------------------------------------------------------
# ASGI wrapper (Socket.io + FastAPI)
# ---------------------------------------------------------------------------
app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=fastapi_app
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=5000, reload=True)
