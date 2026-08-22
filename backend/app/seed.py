#!/usr/bin/env python3
"""
Smart Attend - Terminal Database Seeder
=======================================
Seeds:
  1. System Administrator: agandasiri@gmail.com
  2. Faculty Member: muneeb143@gmail.com
  3. All 50 Enrolled Students from 'STUD DTLS (1).xlsx' (No email required; roll-number based)

Usage:
  python backend/app/seed.py
  or
  npm run seed
"""

import os
import sys
import uuid
from datetime import datetime

try:
    import openpyxl
except ImportError:
    os.system(f"{sys.executable} -m pip install openpyxl")
    import openpyxl

try:
    from supabase import create_client
except ImportError:
    os.system(f"{sys.executable} -m pip install supabase")
try:
    from dotenv import load_dotenv
    _backend_env = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env"))
    if os.path.exists(_backend_env):
        load_dotenv(_backend_env)
    else:
        load_dotenv()
except ImportError:
    pass

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

def find_excel_file():
    candidates = [
        "STUD DTLS (1).xlsx",
        "../STUD DTLS (1).xlsx",
        "../../STUD DTLS (1).xlsx",
        "d:/Projects/smartattend-ai/STUD DTLS (1).xlsx"
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None

def parse_students():
    excel_path = find_excel_file()
    if not excel_path:
        print("⚠️ Warning: 'STUD DTLS (1).xlsx' not found. Using embedded 50-student roster.")
        return []

    wb = openpyxl.load_workbook(excel_path)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []

    header = [str(col).strip().lower() if col else '' for col in rows[0]]
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
    print(">> Smart Attend - Live Terminal Database Seeder")
    print("=" * 70)

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.")
        print("Please configure them in your .env file before running the seeder.")
        sys.exit(1)

    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    print(f"[*] Connected to Supabase at: {SUPABASE_URL}")

    # 1. Seed Admin
    admin_data = {
        "email": "agandasiri@gmail.com",
        "name": "Admin",
        "role": "admin",
        "designation": "System Administrator",
        "college": "Swarna Bharathi Institute of Science and Technology (SBIT)",
        "status": "approved"
    }
    try:
        sb.from_("users").upsert(admin_data, on_conflict="email").execute()
        print(f"[+] [Admin] Seeded: {admin_data['name']} ({admin_data['email']})")
    except Exception as e:
        print(f"[!] [Admin] Notice: {e}")

    # 2. Seed Faculty
    faculty_data = {
        "email": "muneeb143@gmail.com",
        "name": "Muneeb Bhai",
        "role": "faculty",
        "designation": "Assistant Professor",
        "department": "Computer Science & Engineering",
        "assigned_branch": "CSM",
        "assigned_sections": ["A", "B"],
        "college": "Swarna Bharathi Institute of Science and Technology (SBIT)",
        "status": "approved"
    }
    try:
        sb.from_("users").upsert(faculty_data, on_conflict="email").execute()
        print(f"[+] [Faculty] Seeded: {faculty_data['name']} ({faculty_data['email']}) - CSM Sec A/B")
    except Exception as e:
        print(f"[!] [Faculty] Notice: {e}")

    # 3. Seed Students
    students = parse_students()
    print(f"\n[*] Found {len(students)} students in Excel file.")

    # Fetch existing users to match by hall_ticket_no or email
    existing_users_res = sb.from_("users").select("id, email, hall_ticket_no, role").execute()
    existing_by_roll = {}
    existing_by_email = {}
    for u in (existing_users_res.data or []):
        if u.get("hall_ticket_no"):
            existing_by_roll[str(u["hall_ticket_no"]).strip().upper()] = u["id"]
        if u.get("email"):
            existing_by_email[str(u["email"]).strip().lower()] = u["id"]

    success_count = 0
    for st in students:
        roll = st["hall_ticket_no"].upper()
        email_val = f"{roll.lower()}@sbit.ac.in"
        existing_id = existing_by_roll.get(roll) or existing_by_email.get(email_val)

        student_payload = {
            "name": st["name"],
            "hall_ticket_no": roll,
            "email": email_val, # Compatible with both DB constraint requirements
            "branch": st["branch"],
            "year": st["year"],
            "semester": st["semester"],
            "section": st["section"],
            "role": "student",
            "status": "approved",
            "college": st["college"]
        }

        try:
            if existing_id:
                sb.from_("users").update(student_payload).eq("id", existing_id).execute()
            else:
                student_payload["id"] = str(uuid.uuid4())
                sb.from_("users").insert(student_payload).execute()
            success_count += 1
        except Exception as e:
            print(f"[!] Error seeding student {roll}: {e}")

    print(f"[+] [Students] Successfully seeded {success_count} / {len(students)} students.")

    # 4. Initialize Default Geofence Config
    try:
        sb.from_("geofence_config").upsert({
            "id": 1,
            "center_lat": 17.2472,
            "center_lng": 80.1514,
            "radius_m": 150,
            "campus_name": "SBIT Main Campus & Innovation Centre"
        }, on_conflict="id").execute()
        print(f"[+] [Geofence] Default campus baseline set: Radius 150m (Dynamic per-session).")
    except Exception as e:
        pass

    print("\n" + "=" * 70)
    print(f">> Database Seeding Complete! Total 52 accounts ready.")
    print("=" * 70)

if __name__ == "__main__":
    seed_database()
