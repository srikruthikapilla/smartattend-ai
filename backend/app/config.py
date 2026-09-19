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

if IS_PRODUCTION:
    if not CORS_ORIGINS or any(orig == "*" for orig in CORS_ORIGINS):
        raise RuntimeError("CRITICAL SECURITY ERROR: Wildcard '*' CORS origin is not permitted in production. Provide explicit production origin.")

# Helper to check if running in a container
def _is_running_in_container() -> bool:
    return (
        os.path.exists("/.dockerenv")
        or os.path.exists("/run/.containerenv")
        or os.getenv("DOCKER_CONTAINER", "").lower() in ("true", "1")
        or bool(os.getenv("POSTGRES_HOST") and os.getenv("POSTGRES_HOST") != "localhost")
    )

# Database configuration
_INSECURE_DB_PASSWORDS = {"postgres", "postgrespassword", "password", "admin", "ak", "root", "localdevpassword123"}

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    db_user = os.getenv("POSTGRES_USER", "postgres")
    if IS_PRODUCTION:
        db_pass = os.getenv("POSTGRES_PASSWORD")
        if not db_pass:
            raise RuntimeError("CRITICAL SECURITY ERROR: POSTGRES_PASSWORD environment variable is required in production.")
        if len(db_pass) < 16:
            raise RuntimeError("CRITICAL SECURITY ERROR: POSTGRES_PASSWORD must be at least 16 characters long in production.")
        if db_pass.strip().lower() in _INSECURE_DB_PASSWORDS:
            raise RuntimeError("CRITICAL SECURITY ERROR: Insecure or default POSTGRES_PASSWORD cannot be used in production.")
    else:
        db_pass = os.getenv("POSTGRES_PASSWORD", "postgrespassword")

    db_host = os.getenv("POSTGRES_HOST", "postgres" if _is_running_in_container() else "localhost")
    db_port = os.getenv("POSTGRES_PORT", "5432")
    db_name = os.getenv("POSTGRES_DB", "smartattend")
    DATABASE_URL = f"postgresql://{db_user}:{db_pass}@{db_host}:{db_port}/{db_name}"
else:
    # If DATABASE_URL was provided directly in production, validate password within URL
    if IS_PRODUCTION:
        for bad_pass in _INSECURE_DB_PASSWORDS:
            if f":{bad_pass}@" in DATABASE_URL.lower():
                raise RuntimeError(f"CRITICAL SECURITY ERROR: Insecure default password '{bad_pass}' detected in DATABASE_URL in production.")

# If running locally outside docker, translate docker hostnames to localhost
if not _is_running_in_container():
    if "@postgres:" in DATABASE_URL:
        DATABASE_URL = DATABASE_URL.replace("@postgres:", "@localhost:")

# In production, also validate POSTGRES_PASSWORD if specified independently
if IS_PRODUCTION:
    raw_pass = os.getenv("POSTGRES_PASSWORD")
    if raw_pass:
        if len(raw_pass) < 16:
            raise RuntimeError("CRITICAL SECURITY ERROR: POSTGRES_PASSWORD must be at least 16 characters long in production.")
        if raw_pass.strip().lower() in _INSECURE_DB_PASSWORDS:
            raise RuntimeError("CRITICAL SECURITY ERROR: Insecure or default POSTGRES_PASSWORD cannot be used in production.")

# ---------------------------------------------------------------------------
# Redis configuration (supports REDIS_URL, REDIS_URI, or standalone variables)
# ---------------------------------------------------------------------------
_RAW_REDIS_URL = os.getenv("REDIS_URL") or os.getenv("REDIS_URI")
if not _RAW_REDIS_URL:
    redis_host = os.getenv("REDIS_HOST", "redis" if _is_running_in_container() else "localhost")
    redis_port = os.getenv("REDIS_PORT", "6379")
    redis_password = os.getenv("REDIS_PASSWORD") or os.getenv("REDIS_PASS") or ""
    redis_user = os.getenv("REDIS_USER") or os.getenv("REDIS_USERNAME") or ""
    redis_db = os.getenv("REDIS_DB", "0")
    redis_tls = os.getenv("REDIS_TLS", "false").lower() in ("true", "1", "yes")
    scheme = "rediss" if redis_tls else "redis"

    if redis_password:
        from urllib.parse import quote
        auth = f"{quote(redis_user)}:{quote(redis_password)}@" if redis_user else f":{quote(redis_password)}@"
    else:
        auth = ""

    REDIS_URL = f"{scheme}://{auth}{redis_host}:{redis_port}/{redis_db}"
else:
    REDIS_URL = _RAW_REDIS_URL
    # If REDIS_PASSWORD was provided as a separate environment variable in Coolify
    # and is not already embedded in REDIS_URL, inject it
    redis_password = os.getenv("REDIS_PASSWORD") or os.getenv("REDIS_PASS")
    if redis_password and "@" not in REDIS_URL:
        from urllib.parse import quote
        redis_user = os.getenv("REDIS_USER") or os.getenv("REDIS_USERNAME") or ""
        auth = f"{quote(redis_user)}:{quote(redis_password)}@" if redis_user else f":{quote(redis_password)}@"
        if "://" in REDIS_URL:
            scheme, rest = REDIS_URL.split("://", 1)
            REDIS_URL = f"{scheme}://{auth}{rest}"
        else:
            REDIS_URL = f"redis://{auth}{REDIS_URL}"

# If running locally outside docker container, translate internal container host to localhost
if not _is_running_in_container():
    if "://redis:" in REDIS_URL:
        REDIS_URL = REDIS_URL.replace("://redis:", "://localhost:")
    elif "@redis:" in REDIS_URL:
        REDIS_URL = REDIS_URL.replace("@redis:", "@localhost:")

# ---------------------------------------------------------------------------
# SMTP configuration (supports Brevo or standard SMTP variables in Coolify)
# ---------------------------------------------------------------------------
BREVO_SMTP_SERVER = (
    os.getenv("BREVO_SMTP_SERVER")
    or os.getenv("SMTP_HOST")
    or os.getenv("SMTP_SERVER")
    or "smtp-relay.brevo.com"
)
BREVO_SMTP_PORT = int(
    os.getenv("BREVO_SMTP_PORT")
    or os.getenv("SMTP_PORT")
    or "587"
)
BREVO_SMTP_LOGIN = (
    os.getenv("BREVO_SMTP_LOGIN")
    or os.getenv("SMTP_USER")
    or os.getenv("SMTP_USERNAME")
    or os.getenv("SMTP_LOGIN")
    or ""
)
BREVO_SMTP_KEY = (
    os.getenv("BREVO_SMTP_KEY")
    or os.getenv("SMTP_PASSWORD")
    or os.getenv("SMTP_PASS")
    or os.getenv("SMTP_KEY")
    or ""
)
BREVO_FROM_EMAIL = (
    os.getenv("BREVO_FROM_EMAIL")
    or os.getenv("SMTP_FROM_EMAIL")
    or os.getenv("MAIL_FROM")
    or os.getenv("SMTP_FROM")
    or ""
)
BREVO_FROM_NAME = (
    os.getenv("BREVO_FROM_NAME")
    or os.getenv("SMTP_FROM_NAME")
    or os.getenv("MAIL_FROM_NAME")
    or "Smart Attend — SBIT"
)
BREVO_SMTP_USE_SSL = (
    os.getenv("BREVO_SMTP_USE_SSL", "").lower() in ("true", "1", "yes")
    or os.getenv("SMTP_USE_SSL", "").lower() in ("true", "1", "yes")
    or os.getenv("SMTP_SECURE", "").lower() in ("true", "1", "yes", "ssl")
    or BREVO_SMTP_PORT == 465
)

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
