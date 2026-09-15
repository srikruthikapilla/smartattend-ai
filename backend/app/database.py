"""
Smart Attend — Database Module
================================
PostgreSQL is the exclusive database engine for all data storage and authentication.

This module provides:
  - SQLAlchemy engine & session factory for PostgreSQL
  - get_db() FastAPI dependency for route injection
  - get_db_context() context manager for non-route code (startup, sockets, seeders)
  - init_db() to verify connectivity, create tables, seed default geofence, and
    bootstrap the first administrator account from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
"""

import uuid
import logging
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

from app.config import DATABASE_URL

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# PostgreSQL Engine & Session
# ---------------------------------------------------------------------------

# Normalize postgres:// to postgresql:// for SQLAlchemy 2.0
pg_url = DATABASE_URL
if pg_url.startswith("postgres://"):
    pg_url = pg_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    pg_url,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=1800,   # Recycle connections every 30 min to avoid stale connections
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency — yields a SQLAlchemy session, auto-closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context() -> Generator[Session, None, None]:
    """Context manager for non-route code (startup hooks, socket handlers, seeders)."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """
    Called once at application startup.
    1. Creates all tables (if missing).
    2. Seeds the default SBIT geofence row.
    3. Bootstraps the first administrator account from ADMIN_EMAIL / ADMIN_PASSWORD
       environment variables if no admin accounts exist yet.
    """
    from app.models.db_models import Base, GeofenceConfig, Admin
    from app.config import ADMIN_EMAIL, ADMIN_PASSWORD
    from app.utils.security import hash_password

    # Create tables that don't exist yet (safe to call repeatedly)
    Base.metadata.create_all(bind=engine)
    logger.info("PostgreSQL tables verified / created.")

    # Incremental column migrations & constraints
    try:
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE students ADD COLUMN IF NOT EXISTS biometric_sign_count INTEGER DEFAULT 0 NOT NULL;"))
            # Delete legacy fake/test student records with null or fake emails before enforcing NOT NULL
            conn.execute(text("DELETE FROM students WHERE email IS NULL OR email LIKE 'test.security.%' OR name LIKE 'Student (%' OR name = 'No Email Student';"))
            conn.execute(text("DELETE FROM admins WHERE email = 'rogue.admin@sbit.ac.in';"))
            conn.execute(text("ALTER TABLE students ALTER COLUMN email SET NOT NULL;"))
            conn.execute(text("""
                ALTER TABLE attendance_records DROP CONSTRAINT IF EXISTS attendance_records_verification_method_check;
                ALTER TABLE attendance_records ADD CONSTRAINT attendance_records_verification_method_check 
                CHECK (verification_method IN ('face_recognition', 'biometric_fallback', 'webauthn_platform', 'qr_gps', 'manual'));
            """))
            conn.commit()
    except Exception as e:
        logger.warning(f"Incremental schema migration note: {e}")

    with get_db_context() as db:
        # --- Seed default geofence ---
        existing_geo = db.query(GeofenceConfig).filter_by(id=1).first()
        if not existing_geo:
            db.add(GeofenceConfig(
                id=1,
                center_lat=17.2472,
                center_lng=80.1514,
                radius_m=150,
                address="SBIT Campus, Pakabanda Street, Khammam, Telangana 507002",
                enabled=True,
            ))
            db.commit()
            logger.info("Default SBIT campus geofence row seeded.")

        # --- Bootstrap / Sync admin from environment variables ---
        if ADMIN_EMAIL and ADMIN_PASSWORD:
            from sqlalchemy import func
            from app.utils.security import verify_password
            clean_email = ADMIN_EMAIL.strip().lower()
            existing_admin = db.query(Admin).filter(
                func.lower(Admin.email) == clean_email
            ).first()

            if not existing_admin:
                if db.query(Admin).count() == 0:
                    bootstrap_admin = Admin(
                        id=uuid.uuid4(),
                        email=clean_email,
                        password_hash=hash_password(ADMIN_PASSWORD),
                        name="System Administrator",
                        role="admin",
                        designation="System Administrator",
                        college="Swarna Bharathi Institute of Science and Technology (SBIT)",
                        status="approved",
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                    db.add(bootstrap_admin)
                    db.commit()
                    logger.info(f"Bootstrap administrator created: {clean_email}")
            else:
                # Synchronize password with ADMIN_PASSWORD env var if it changed
                if not verify_password(ADMIN_PASSWORD, existing_admin.password_hash):
                    existing_admin.password_hash = hash_password(ADMIN_PASSWORD)
                    existing_admin.updated_at = datetime.now(timezone.utc)
                    db.commit()
                    logger.info(f"Synchronized administrator password from environment for: {clean_email}")
        else:
            logger.warning(
                "ADMIN_EMAIL or ADMIN_PASSWORD is not set. Skipping admin bootstrap."
            )

    # Quick connectivity check
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(f"PostgreSQL connection verified: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
    except Exception as e:
        logger.error(f"PostgreSQL connection failed: {e}")
