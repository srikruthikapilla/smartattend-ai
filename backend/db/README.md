# 🗄️ Smart Attend - Database Schema Directory

This folder contains separate, production-ready database schemas for both **Supabase** and **Standalone PostgreSQL**:

---

## 📁 Available Schema Files

| Schema File | Target Database | Description |
| :--- | :--- | :--- |
| **[`supabase_schema.sql`](file:///d:/Projects/smartattend-ai/backend/db/supabase_schema.sql)** | **Supabase (Cloud / Self-Hosted)** | Includes Supabase RLS policies, Realtime publication channels, Supabase Auth integration, and triggers. |
| **[`postgresql_schema.sql`](file:///d:/Projects/smartattend-ai/backend/db/postgresql_schema.sql)** | **Standalone PostgreSQL / Docker / RDS** | Standard relational PostgreSQL schema with `password_hash`, UUID generators, indices, and timestamp triggers. |
| **[`schema.sql`](file:///d:/Projects/smartattend-ai/backend/db/schema.sql)** | **Master Reference** | Comprehensive unified schema reference. |

---

## 🚀 How to Run

### Option 1: Running in Supabase Dashboard (Recommended)
1. Open your **Supabase Project Dashboard** (`https://supabase.com/dashboard/project/<your-project-id>`).
2. Navigate to **SQL Editor** from the left sidebar.
3. Open [`supabase_schema.sql`](file:///d:/Projects/smartattend-ai/backend/db/supabase_schema.sql), copy the entire SQL script, and paste it into the editor.
4. Click **Run**.
5. To insert your initial admin user without constraint errors:
   ```sql
   INSERT INTO public.users (
       email,
       role,
       name,
       status,
       college
   ) VALUES (
       'yourname@sbit.ac.in',
       'admin',
       'Administrator',
       'approved',
       'Swarna Bharathi Institute of Science and Technology (SBIT)'
   )
   ON CONFLICT (email) DO UPDATE 
   SET role = 'admin', status = 'approved';
   ```

---

### Option 2: Running in Standalone PostgreSQL / Docker
Using `psql`:
```bash
psql -h localhost -U postgres -d smartattend -f backend/db/postgresql_schema.sql
```

Using Docker Compose:
```bash
docker exec -i smartattend-postgres psql -U postgres -d smartattend < backend/db/postgresql_schema.sql
```
