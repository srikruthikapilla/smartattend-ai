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

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgrespassword@localhost:5432/smartattend")
if not os.path.exists("/.dockerenv") and "@postgres:" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("@postgres:", "@localhost:")

# Redis configuration for OTP with TTL
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
if not os.path.exists("/.dockerenv") and "@redis:" in REDIS_URL:
    REDIS_URL = REDIS_URL.replace("@redis:", "@localhost:")

# Brevo (Sendinblue) SMTP configuration
BREVO_SMTP_SERVER = os.getenv("BREVO_SMTP_SERVER", "smtp-relay.brevo.com")
BREVO_SMTP_PORT = int(os.getenv("BREVO_SMTP_PORT", "587"))
BREVO_SMTP_LOGIN = os.getenv("BREVO_SMTP_LOGIN", "")
BREVO_SMTP_KEY = os.getenv("BREVO_SMTP_KEY", "")
BREVO_FROM_EMAIL = os.getenv("BREVO_FROM_EMAIL", "")
BREVO_FROM_NAME = os.getenv("BREVO_FROM_NAME", "Smart Attend — SBIT")

NODE_ENV = os.getenv("NODE_ENV", "development").lower()
IS_PRODUCTION = NODE_ENV == "production"

# ---------------------------------------------------------------------------
# Security Secrets — MUST be overridden in production
# ---------------------------------------------------------------------------
_INSECURE_JWT_DEFAULT = "smartattend-secure-qr-jwt-key-2026"
JWT_SECRET = os.getenv("JWT_SECRET", _INSECURE_JWT_DEFAULT)
if IS_PRODUCTION and (not JWT_SECRET or JWT_SECRET == _INSECURE_JWT_DEFAULT):
    raise RuntimeError("CRITICAL SECURITY ERROR: A custom JWT_SECRET must be set in production.")

_INSECURE_EDGE_DEFAULT = "smartattend-edge-default-key"
EDGE_API_KEY = os.getenv("EDGE_API_KEY", _INSECURE_EDGE_DEFAULT)
if IS_PRODUCTION and (not EDGE_API_KEY or EDGE_API_KEY == _INSECURE_EDGE_DEFAULT):
    raise RuntimeError("CRITICAL SECURITY ERROR: A custom EDGE_API_KEY must be set in production.")

# ---------------------------------------------------------------------------
# Bootstrap Admin — seeded on first startup if no admin accounts exist
# ---------------------------------------------------------------------------
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@sbit.ac.in")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "Admin@123!")
