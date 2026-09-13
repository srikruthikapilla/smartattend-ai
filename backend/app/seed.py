#!/usr/bin/env python3
"""
Smart Attend — Initial Database Seeder
======================================
Seeds ONLY the initial Administrator account:
  - Email: admin@gmail.com
  - Password: admin
  - Role: admin

No fake details are seeded. Additional administrators, faculty members,
and students can be added individually or in bulk via Excel import through the
Admin Dashboard.

Usage:
  python app/seed.py
"""

import os
import sys
import uuid
from datetime import datetime, timezone

# Ensure project backend directory is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_root = os.path.abspath(os.path.join(current_dir, ".."))
if backend_root not in sys.path:
    sys.path.insert(0, backend_root)

from app.database import init_db, get_db_context
from app.models.db_models import Admin, Faculty, Student, GeofenceConfig
from app.config import DATABASE_URL
from app.utils.security import hash_password


def seed_database():
    print("=" * 70)
    print(">> Smart Attend — System Seeder (Admin Only)")
    print(f"[*] Target PostgreSQL URL: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
    print("=" * 70)

    # 1. Initialize schema in PostgreSQL
    init_db()

    default_admin_pwd_hash = hash_password("admin")

    with get_db_context() as db:
        now_dt = datetime.now(timezone.utc)

        # 2. Seed Default Administrator if no admin accounts exist
        admin_count = db.query(Admin).count()
        if admin_count == 0:
            admin_email = "admin@gmail.com"
            admin_user = Admin(
                id=uuid.uuid4(),
                email=admin_email,
                password_hash=default_admin_pwd_hash,
                name="System Administrator",
                role="admin",
                designation="System Administrator",
                college="Swarna Bharathi Institute of Science and Technology (SBIT)",
                status="approved",
                created_at=now_dt,
                updated_at=now_dt
            )
            db.add(admin_user)
            print(f"[+] [Admins Table] Initialized bootstrap admin: {admin_email} (password: admin)")
        else:
            print(f"[*] [Admins Table] Existing administrator(s) found ({admin_count}). Preserving current accounts.")

        # 3. Seed Campus Baseline Geofence Configuration
        geo = db.query(GeofenceConfig).filter_by(id=1).first()
        if not geo:
            geo = GeofenceConfig(
                id=1,
                center_lat=17.2472,
                center_lng=80.1514,
                radius_m=150,
                address="SBIT Campus, Pakabanda Street, Khammam, Telangana 507002",
                enabled=True,
                updated_at=now_dt
            )
            db.add(geo)
            print("[+] [Geofence] Default campus baseline set: Radius 150m.")

        db.commit()

    print("\n" + "=" * 70)
    print(">> Initial Setup Complete!")
    print("   [admins] admin@gmail.com / admin")
    print("   (Faculty and students can be registered manually or in bulk via Excel)")
    print("=" * 70)


if __name__ == "__main__":
    seed_database()
