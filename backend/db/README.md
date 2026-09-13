# 🗄️ Smart Attend - Database Schema Directory

This directory contains the production-ready schema for **PostgreSQL**.

---

## 📁 Schema File

| Schema File | Target Database | Description |
| :--- | :--- | :--- |
| **[`postgresql_schema.sql`](postgresql_schema.sql)** | **PostgreSQL (Docker / Local / Cloud)** | Defines separate tables for `admins`, `faculty`, and `students`, along with `sessions`, `attendance_records`, `geofence_config`, `audit_logs`, and `revoked_tokens`. |

---

## 🚀 How to Run

### Automatic Initialization (Docker Compose)
`docker-compose.yml` mounts `postgresql_schema.sql` into `/docker-entrypoint-initdb.d/01_schema.sql`, which automatically executes when the container is initialized for the first time.

### Manual Execution via `psql`
```bash
psql -h localhost -U postgres -d smartattend -f backend/db/postgresql_schema.sql
```

### Manual Execution via Docker Container
```bash
docker exec -i smartattend-postgres psql -U postgres -d smartattend < backend/db/postgresql_schema.sql
```
