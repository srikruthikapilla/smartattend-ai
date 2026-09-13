#!/usr/bin/env python3
"""
Smart Attend — Initial Database Seeder
======================================
Seeds ONLY the initial Administrator account from environment variables:
  - ADMIN_EMAIL (default: admin@sbit.ac.in)
  - ADMIN_PASSWORD (default: Admin@123!)

The admin bootstrap is now also performed automatically on every startup
via database.init_db(). This standalone script is kept for manual re-seeding.

No fake details are seeded. Additional administrators, faculty members,
and students can be added individually or in bulk via Excel import through
the Admin Dashboard.

Usage:
  python app/seed.py
"""

import os
import sys

# Ensure project backend directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.abspath(os.path.join(current_dir, ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.database import init_db, get_db_context
from app.models.db_models import Admin
from app.config import DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD


def seed_database():
    print("=" * 70)
    print(">> Smart Attend — System Seeder (Admin Only)")
    print(f"[*] Target PostgreSQL URL: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
    print(f"[*] Bootstrap admin email: {ADMIN_EMAIL}")
    print("=" * 70)

    # init_db() handles all table creation + geofence + admin bootstrap
    init_db()

    with get_db_context() as db:
        admin_count = db.query(Admin).count()
        print(f"\n[*] Total administrator accounts: {admin_count}")
        for a in db.query(Admin).all():
            print(f"    - {a.email} ({a.status})")

    print("\n" + "=" * 70)
    print(">> Seeding Complete!")
    print(f"   Login with: {ADMIN_EMAIL} / <your ADMIN_PASSWORD>")
    print("   (Faculty and students can be registered manually or in bulk via Excel)")
    print("=" * 70)


if __name__ == "__main__":
    seed_database()
