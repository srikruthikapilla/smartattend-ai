import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.routes.health import router as health_router
from app.routes.student_face import router as student_face_router
from app.routes.qr_session import router as qr_session_router
from app.routes.checkin import router as checkin_router, set_sio_server
from app.routes.attendance import router as attendance_router, set_sio_server as set_attendance_sio
from app.routes.admin import router as admin_router
from app.routes.auth import router as auth_router

# 1. Initialize Socket.io Async Server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*"
)

set_sio_server(sio)
set_attendance_sio(sio)

@sio.event
async def connect(sid, environ):
    print(f"🔌 WebSocket Client Connected to Live Attendance Stream: {sid}")

@sio.event
async def disconnect(sid):
    print(f"❌ WebSocket Client Disconnected: {sid}")

# 2. Initialize FastAPI Application
fastapi_app = FastAPI(
    title="Smart Attend — Face & Biometric Attendance Backend",
    description="High-performance async FastAPI backend with native NumPy face embedding matching and real-time WebSockets.",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@fastapi_app.on_event("startup")
async def preload_enrolled_face_embeddings():
    """Pre-loads all registered face embeddings into the in-memory fast matching registry on boot."""
    from app.database import supabase_client
    from app.services.face_recognition_service import face_service
    if supabase_client:
        try:
            res = supabase_client.table("users")\
                .select("id, name, hall_ticket_no, face_descriptor")\
                .eq("face_enrollment_status", "enrolled")\
                .execute()
            if res.data:
                loaded = 0
                for u in res.data:
                    ht = u.get("hall_ticket_no")
                    desc = u.get("face_descriptor")
                    if ht and desc and isinstance(desc, list) and len(desc) in (128, 512):
                        face_service.register_embedding(
                            hall_ticket=ht,
                            vector=desc,
                            name=u.get("name"),
                            student_id=str(u.get("id"))
                        )
                        loaded += 1
                print(f"🚀 [Face AI] Preloaded {loaded} active face vector embeddings into vectorized matrix.")
        except Exception as e:
            print(f"⚠️ [Face AI] Preload note: {e}")

# 3. Mount Routers
fastapi_app.include_router(health_router)
fastapi_app.include_router(student_face_router)
fastapi_app.include_router(qr_session_router)
fastapi_app.include_router(checkin_router)
fastapi_app.include_router(attendance_router)
fastapi_app.include_router(admin_router)
fastapi_app.include_router(auth_router)

# 4. Wrap with Socket.io ASGI app
app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=fastapi_app
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=5000, reload=True)
