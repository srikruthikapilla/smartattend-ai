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

NODE_ENV = os.getenv("NODE_ENV", "development").lower()
IS_PRODUCTION = NODE_ENV == "production"

PORT = int(os.getenv("PORT", "5000"))
CORS_ORIGIN = os.getenv("CORS_ORIGIN", "http://localhost:3000")
CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", CORS_ORIGIN)
CORS_ORIGINS = [orig.strip() for orig in CORS_ORIGINS_RAW.split(",") if orig.strip()]

# Helper to check if running in a container
def _is_running_in_container() -> bool:
    return (
        os.path.exists("/.dockerenv")
        or os.path.exists("/run/.containerenv")
        or os.getenv("DOCKER_CONTAINER", "").lower() in ("true", "1")
        or bool(os.getenv("POSTGRES_HOST") and os.getenv("POSTGRES_HOST") != "localhost")
    )

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    db_user = os.getenv("POSTGRES_USER", "postgres")
    db_pass = os.getenv("POSTGRES_PASSWORD", "postgrespassword")
    db_host = os.getenv("POSTGRES_HOST", "postgres" if _is_running_in_container() else "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "smartattend")
    DATABASE_URL = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"

# If running locally outside docker, translate docker hostnames to localhost
if not _is_running_in_container():
    if "@postgres:" in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("@postgres:", "@localhost:")

# Reject default DB password in production
if IS_PRODUCTION and ("postgrespassword" in DATABASE_URL or "localdevpassword123" in DATABASE_URL):
    raise RuntimeError("CRITICAL SECURITY ERROR: POSTGRES_PASSWORD must not be the default in production.")

# Redis configuration for OTP with TTL
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
if not _is_running_in_container() and "@redis:" in REDIS_URL:
    REDIS_URL = REDIS_URL.replace("@redis:", "@localhost:")

# Brevo (Sendinblue) SMTP configuration
BREVO_SMTP_SERVER = os.getenv("BREVO_SMTP_SERVER", "smtp-relay.brevo.com")
BREVO_SMTP_PORT = int(os.getenv("BREVO_SMTP_PORT", "587"))
BREVO_SMTP_LOGIN = os.getenv("BREVO_SMTP_LOGIN", "")
BREVO_SMTP_KEY = os.getenv("BREVO_SMTP_KEY", "")
BREVO_FROM_EMAIL = os.getenv("BREVO_FROM_EMAIL", "")
BREVO_FROM_NAME = os.getenv("BREVO_FROM_NAME", "Smart Attend — SBIT")

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

if IS_PRODUCTION and (not ADMIN_EMAIL or ADMIN_EMAIL == "admin@sbit.ac.in"):
    raise RuntimeError("CRITICAL SECURITY ERROR: ADMIN_EMAIL must be set via environment variable in production.")
if IS_PRODUCTION and (not ADMIN_PASSWORD or ADMIN_PASSWORD == "Admin@123!"):
    raise RuntimeError("CRITICAL SECURITY ERROR: ADMIN_PASSWORD must be set via environment variable in production.")

# ---------------------------------------------------------------------------
# Cookie Configuration for httpOnly JWT
# ---------------------------------------------------------------------------
COOKIE_NAME = "sbit_auth_token"
COOKIE_MAX_AGE = 8 * 3600  # 8 hours in seconds (matches JWT expiry)
COOKIE_DOMAIN = os.getenv("COOKIE_DOMAIN", None)  # None for current domain
COOKIE_SECURE = IS_PRODUCTION  # Secure flag only in production
COOKIE_SAMESITE = "lax"  # CSRF protection: 'strict', 'lax', or 'none'
