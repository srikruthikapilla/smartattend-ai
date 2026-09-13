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

        # --- Bootstrap admin from environment variables ---
        admin_count = db.query(Admin).count()
        if admin_count == 0:
            if not ADMIN_EMAIL or not ADMIN_PASSWORD:
                logger.warning(
                    "No admin accounts exist and ADMIN_EMAIL/ADMIN_PASSWORD are not set. "
                    "Set these env vars to create the bootstrap admin automatically."
                )
            else:
                from sqlalchemy import func
                existing_admin = db.query(Admin).filter(
                    func.lower(Admin.email) == ADMIN_EMAIL.strip().lower()
                ).first()
                if not existing_admin:
                    bootstrap_admin = Admin(
                        id=uuid.uuid4(),
                        email=ADMIN_EMAIL.strip().lower(),
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
                    logger.info(f"Bootstrap administrator created: {ADMIN_EMAIL}")

    # Quick connectivity check
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(f"PostgreSQL connection verified: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
    except Exception as e:
        logger.error(f"PostgreSQL connection failed: {e}")
