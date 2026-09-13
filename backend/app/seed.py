#!/usr/bin/env python3
"""
Smart Attend — Terminal PostgreSQL Database Seeder
===================================================
Seeds directly into PostgreSQL:
  1. System Administrator: agandasiri@gmail.com
  2. Faculty Member: muneeb143@gmail.com
  3. All 50 Enrolled Students from 'STUD DTLS (1).xlsx'
  4. Campus Baseline Geofence Configuration

Usage:
  python backend/app/seed.py
  or
  npm run seed
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

try:
    import openpyxl
except ImportError:
    os.system(f"{sys.executable} -m pip install openpyxl")
    import openpyxl

from app.database import init_db, get_db_context, supabase_auth
from app.models.db_models import User, GeofenceConfig
from app.config import DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY


def find_excel_file():
    candidates = [
        "STUD DTLS (1).xlsx",
        "../STUD DTLS (1).xlsx",
        "../../STUD DTLS (1).xlsx",
        os.path.join(backend_root, "..", "STUD DTLS (1).xlsx"),
        "d:/Projects/smartattend-ai/STUD DTLS (1).xlsx"
    ]
    for c in candidates:
        if os.path.exists(c):
            return os.path.abspath(c)
    return None


def parse_students():
    excel_path = find_excel_file()
    if not excel_path:
        print("⚠️ Warning: 'STUD DTLS (1).xlsx' not found. Skipping student import.")
        return []

    wb = openpyxl.load_workbook(excel_path)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    students = []
    for r in rows[1:]:
        if not any(r):
            continue
        name = str(r[0]).strip() if r[0] else "Student"
        roll = str(r[1]).strip().upper() if r[1] else None
        if not roll or roll.lower() == 'none':
            continue

        branch = str(r[2]).strip() if len(r) > 2 and r[2] else "CSM"
        year = str(r[3]).strip() if len(r) > 3 and r[3] else "3"
        semester = str(r[4]).strip() if len(r) > 4 and r[4] else "1"
        section = str(r[5]).strip() if len(r) > 5 and r[5] and str(r[5]).strip().lower() != 'none' else "A"

        students.append({
            "name": name,
            "hall_ticket_no": roll,
            "branch": branch,
            "year": year,
            "semester": semester,
            "section": section,
            "role": "student",
            "status": "approved",
            "college": "Swarna Bharathi Institute of Science and Technology (SBIT)"
        })

    return students


def seed_database():
    print("=" * 70)
    print(">> Smart Attend — PostgreSQL Database Seeder")
    print(f"[*] Target PostgreSQL URL: {DATABASE_URL.split('@')[-1] if '@' in DATABASE_URL else DATABASE_URL}")
    print("=" * 70)

    # 1. Initialize schema in PostgreSQL
    init_db()

    with get_db_context() as db:
        now_dt = datetime.now(timezone.utc)

        # 2. Seed Administrator
        admin_email = "agandasiri@gmail.com"
        admin_user = db.query(User).filter_by(email=admin_email).first()
        if not admin_user:
            admin_user = User(
                id=uuid.uuid4(),
                email=admin_email,
                name="Admin",
                role="admin",
                designation="System Administrator",
                college="Swarna Bharathi Institute of Science and Technology (SBIT)",
                status="approved",
                created_at=now_dt,
                updated_at=now_dt
            )
            db.add(admin_user)
            print(f"[+] [Admin] Created: {admin_user.name} ({admin_user.email})")
        else:
            admin_user.role = "admin"
            admin_user.status = "approved"
            admin_user.updated_at = now_dt
            print(f"[+] [Admin] Verified: {admin_user.name} ({admin_user.email})")

        # 3. Seed Faculty Member
        faculty_email = "muneeb143@gmail.com"
        faculty_user = db.query(User).filter_by(email=faculty_email).first()
        if not faculty_user:
            faculty_user = User(
                id=uuid.uuid4(),
                email=faculty_email,
                name="Muneeb Bhai",
                role="faculty",
                designation="Assistant Professor",
                department="Computer Science & Engineering",
                assigned_branch="CSM",
                assigned_sections=["A", "B"],
                college="Swarna Bharathi Institute of Science and Technology (SBIT)",
                status="approved",
                created_at=now_dt,
                updated_at=now_dt
            )
            db.add(faculty_user)
            print(f"[+] [Faculty] Created: {faculty_user.name} ({faculty_user.email})")
        else:
            faculty_user.role = "faculty"
            faculty_user.assigned_branch = "CSM"
            faculty_user.assigned_sections = ["A", "B"]
            faculty_user.status = "approved"
            faculty_user.updated_at = now_dt
            print(f"[+] [Faculty] Verified: {faculty_user.name} ({faculty_user.email})")

        # 4. Seed Students from Excel
        students = parse_students()
        print(f"\n[*] Found {len(students)} students to sync.")

        success_count = 0
        for st in students:
            roll = st["hall_ticket_no"].upper()
            email_val = f"{roll.lower()}@sbit.ac.in"

            existing = (
                db.query(User)
                .filter((User.hall_ticket_no == roll) | (User.email == email_val))
                .first()
            )

            if existing:
                existing.name = st["name"]
                existing.hall_ticket_no = roll
                existing.branch = st["branch"]
                existing.year = st["year"]
                existing.semester = st["semester"]
                existing.section = st["section"]
                existing.role = "student"
                existing.status = "approved"
                existing.college = st["college"]
                existing.updated_at = now_dt
            else:
                new_student = User(
                    id=uuid.uuid4(),
                    email=email_val,
                    name=st["name"],
                    hall_ticket_no=roll,
                    branch=st["branch"],
                    year=st["year"],
                    semester=st["semester"],
                    section=st["section"],
                    role="student",
                    status="approved",
                    college=st["college"],
                    created_at=now_dt,
                    updated_at=now_dt
                )
                db.add(new_student)
            success_count += 1

        # 5. Seed Geofence Configuration
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
        print(f"[+] [Students] Successfully seeded/updated {success_count} / {len(students)} students in PostgreSQL.")

    # 6. Optional: Sync Admin & Faculty to Supabase Auth if credentials configured
    if supabase_auth:
        print("\n[*] Syncing admin/faculty credentials with Supabase Auth...")
        for account in [
            {"email": "agandasiri@gmail.com", "role": "admin"},
            {"email": "muneeb143@gmail.com", "role": "faculty"}
        ]:
            try:
                auth_users = supabase_auth.auth.admin.list_users()
                target = next((u for u in auth_users if u.email.lower() == account["email"]), None)
                if not target:
                    supabase_auth.auth.admin.create_user({
                        "email": account["email"],
                        "password": "Password123!",
                        "email_confirm": True,
                        "user_metadata": {"role": account["role"]}
                    })
                    print(f"    [+] Created Supabase Auth user: {account['email']}")
                else:
                    print(f"    [+] Supabase Auth user already exists: {account['email']}")
            except Exception as e:
                print(f"    [!] Supabase Auth sync notice for {account['email']}: {e}")

    print("\n" + "=" * 70)
    print(">> PostgreSQL Database Seeding Complete! All accounts ready.")
    print("=" * 70)


if __name__ == "__main__":
    seed_database()
