"""
Smart Attend — Database Module
================================
PostgreSQL is the exclusive database engine for all data storage and authentication.

This module provides:
  - SQLAlchemy engine & session factory for PostgreSQL
  - get_db() FastAPI dependency for route injection
  - get_db_context() context manager for non-route code (startup, sockets, seeders)
  - init_db() to verify connectivity, create tables & seed default geofence on startup
"""

import logging
from contextlib import contextmanager
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
    Creates all tables (if missing) and inserts the default SBIT geofence row.
    """
    from app.models.db_models import Base, GeofenceConfig

    # Create tables that don't exist yet (safe to call repeatedly)
    Base.metadata.create_all(bind=engine)
    logger.info("PostgreSQL tables verified / created.")

    # Seed default geofence if missing
    with get_db_context() as db:
        existing = db.query(GeofenceConfig).filter_by(id=1).first()
        if not existing:
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

    # Quick connectivity check
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(f"PostgreSQL connection verified: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
    except Exception as e:
        logger.error(f"PostgreSQL connection failed: {e}")
