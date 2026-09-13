import os
from pathlib import Path
from dotenv import load_dotenv

# Explicitly resolve backend/.env
backend_dir = Path(__file__).resolve().parent.parent
backend_env = backend_dir / ".env"
if backend_env.exists():
    load_dotenv(dotenv_path=backend_env)
else:
    load_dotenv()

PORT = int(os.getenv("PORT", "5000"))
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:3000")
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", CORS_ORIGIN)
CORS_ORIGINS = [orig.strip() for orig in CORS_ORIGINS_RAW.split(",") if orig.strip()]

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/smartattend")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")

NODE_ENV = os.getenv("NODE_ENV", "development").lower()

JWT_SECRET = os.getenv("JWT_SECRET") or os.getenv("SUPABASE_JWT_SECRET") or ""
if NODE_ENV == "production" and not JWT_SECRET:
    raise RuntimeError("CRITICAL SECURITY ERROR: JWT_SECRET must be set in production.")

EDGE_API_KEY = os.getenv("EDGE_API_KEY", "")
