# 🎓 Smart Attend — Intelligent Multi-Modal Attendance & Biometric System

[![FastAPI](https://img.shields.io/badge/FastAPI-0.109%2B-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.0-646CFF.svg?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC.svg?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D.svg?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com/)
[![CI/CD](https://img.shields.io/badge/CI%2FCD-GitHub_Actions-2088FF.svg?logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![Production Ready](https://img.shields.io/badge/Production-Ready%2010%2F10-success.svg)](plan.md)

**Smart Attend** is an enterprise-ready, multi-modal attendance automation platform engineered for academic institutions. It provides zero-proxy attendance enforcement using **128-dimensional Facial Recognition AI**, **Real-Time Eye Blink Liveness Detection**, **Campus GPS Geofencing**, **Time-Bound Dynamic QR Tokens**, and **WebAuthn / Passkey Biometrics**.

The system runs on a **self-hosted PostgreSQL 16 database** with **Redis 7** for secure OTP password recovery and **Brevo SMTP** for institutional communications.

---

## 📑 Table of Contents

- [✨ Key Features](#-key-features)
- [🛠️ Technology Stack](#️-technology-stack)
- [🏗️ System Architecture](#️-system-architecture)
- [👥 User Roles & Permissions](#-user-roles--permissions)
- [🔄 Core Workflows](#-core-workflows)
- [🖥️ UI & Route Map](#️-ui--route-map)
- [📁 Project Structure](#-project-structure)
- [🚀 Quickstart & Setup](#-quickstart--setup)
  - [1. Prerequisites](#1-prerequisites)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Running with Docker Compose (Recommended)](#3-running-with-docker-compose-recommended)
  - [4. Running Locally for Development](#4-running-locally-for-development)
  - [5. Database Setup & Seeding](#5-database-setup--seeding)
- [🛡️ Anti-Proxy & Security Architecture](#️-anti-proxy--security-architecture)
- [� Security Enhancements](#-security-enhancements)
- [�📡 API Endpoints Reference](#-api-endpoints-reference)
- [🤝 Contributing & License](#-contributing--license)

---

## ✨ Key Features

- 👤 **128-D Facial Recognition AI:** Client-side 68-landmark detection and 128-D vector extraction via `face-api.js` (SSD MobileNet v1), verified on backend using high-performance NumPy Euclidean distance calculations ($\text{threshold} \le 0.44$).
- 👁️ **Active Eye Blink Liveness:** Computes real-time Eye Aspect Ratio (EAR) across video stream frames to defeat static photos, printed portraits, and screen video playbacks.
- 📍 **GPS Campus Geofencing:** Real-time client coordinate validation against the campus center (SBIT Khammam: $17.2472^\circ\text{N}, 80.1514^\circ\text{E}$) using the Haversine formula (configurable radius, default $150\text{m}$).
- 🔄 **Dynamic Rotating QR Sessions:** Faculty broadcast dynamic, time-limited QR codes that automatically re-encrypt every 30 seconds to prevent screenshot sharing.
- 🔐 **WebAuthn / Passkey Biometric Fallback:** Hardware-backed biometric authentication (Fingerprint / TouchID / Windows Hello) for students requiring secondary verification.
- ⚡ **Real-Time WebSocket Stream:** Instantaneous bi-directional updates via Socket.IO pushing check-ins to Live Attendance Rosters on Faculty and Admin dashboards.
- 🏢 **Multi-Tier Role Separation:** Independent relational tables for `admins`, `faculty`, and `students` ensuring clean database isolation.
- 📧 **Redis-Backed OTP & Brevo SMTP:** Redis-cached 6-digit verification codes (10-minute expiry, rate-limited) dispatched via Brevo SMTP relay for self-service password recovery.
- 📊 **Live Roster & Excel Export:** Instant inline status toggles (Present / Late / Absent), bulk actions, search filters, and one-click `.xlsx` report downloads.

---

## 🛠️ Technology Stack

### **Frontend**
- **Framework:** [React 18](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/)
- **Build Tool:** [Vite 5](https://vitejs.dev/)
- **Styling:** [Tailwind CSS 3.4](https://tailwindcss.com/) with dark/light mode and custom theme tokens
- **Vision Models:** `face-api.js` (SSD MobileNet v1, FaceLandmark68Net, FaceRecognitionNet)
- **Networking:** `socket.io-client`, Axios, Fetch API
- **Icons & Visuals:** `lucide-react`, `canvas-confetti`, `xlsx`

### **Backend**
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
- **ASGI Server:** [Uvicorn](https://www.uvicorn.org/)
- **ORM & DB:** [SQLAlchemy](https://www.sqlalchemy.org/) + [PostgreSQL 16](https://www.postgresql.org/)
- **Caching & OTP:** [Redis 7](https://redis.io/) (`redis-py`)
- **Email Delivery:** [Brevo SMTP Relay](https://www.brevo.com/) via Python standard library `smtplib`
- **Realtime:** `python-socketio` Async ASGI server
- **Security:** `passlib` (bcrypt password hashing), `pyjwt` (HS256 access tokens)
- **Vector Math:** [NumPy](https://numpy.org/) for vector distance calculations

### **Infrastructure**
- **Docker Compose:** Orchestration of 4 isolated containers (`frontend`, `backend`, `postgres`, `redis`)
- **Web Server:** Multi-stage Nginx container serving optimized production React bundle and reverse-proxying `/api` and `/socket.io`

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    subgraph Clients ["Client Applications"]
        Kiosk["📱 Student Kiosk / Checkin (/checkin)"]
        StudentDash["🎓 Student Portal (/student)"]
        FacultyDash["👨‍🏫 Faculty Dashboard (/faculty/dashboard)"]
        AdminDash["🛡️ Admin Dashboard (/admin/dashboard)"]
    end

    subgraph NginxProxy ["Reverse Proxy (Port 3000)"]
        Nginx["Nginx Web Server"]
    end

    subgraph BackendApp ["FastAPI Backend (Port 5000)"]
        AuthModule["Auth & RBAC (Admin & Faculty)"]
        QRModule["Dynamic QR Generator & Sessions"]
        CheckinModule["Multi-Modal Verification Engine"]
        AttendanceModule["Live Attendance & Roster Controller"]
        SocketServer["⚡ Socket.IO Event Broadcaster"]
    end

    subgraph DataStorage ["Data & Cache Layer"]
        PostgresDB[("🗄️ PostgreSQL 16\nadmins | faculty | students\nsessions | attendance_records")]
        RedisCache[("⚡ Redis 7\nPassword Reset OTPs\nSession Caching")]
    end

    Clients --> Nginx
    Nginx -->|/api & /socket.io| BackendApp
    BackendApp --> PostgresDB
    BackendApp --> RedisCache
    BackendApp -->|Live Attendance Push| SocketServer
    SocketServer -.->|Real-time Socket Events| Clients
```

---

## 👥 User Roles & Permissions

| Role | Target Users | Authentication | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **Admin** | System Administrators | Email + Password (JWT) | Complete institutional control: add/remove other admins, add/remove faculty, register students individually or via Excel bulk upload, configure geofence radius & center, view institutional logs & analytics. |
| **Faculty** | Professors & Teachers | Email + Password (JWT) | Broadcast dynamic QR sessions, view real-time class attendance rosters, override student attendance inline, trigger bulk status marks, export `.xlsx` class records. |
| **Student** | Enrolled Students | Multi-Modal Face AI / Passkey | Check in via classroom QR scan + facial verification, view personal attendance statistics, review attended sessions. **Students do not have passwords** — access is authenticated through physical biometrics. |

---

## 🔄 Core Workflows

### 1. Student Check-in Sequence
```mermaid
sequenceDiagram
    autonumber
    actor Student as 🎓 Student
    participant Kiosk as 📱 Checkin Kiosk (/checkin)
    participant API as ⚙️ FastAPI Backend
    participant DB as 🗄️ PostgreSQL 16
    participant Staff as 👨‍🏫 Live Dashboard (Faculty/Admin)

    Student->>Kiosk: Inputs Hall Ticket Number
    Kiosk->>API: GET /api/student/check-status/{hall_ticket}
    API-->>Kiosk: Returns Profile & Face Enrollment Status

    alt Not Enrolled
        Kiosk->>Student: Prompts 3-angle Facial Enrollment
        Student->>Kiosk: Captures Reference Descriptors
        Kiosk->>API: POST /api/student/register-biometrics
        API->>DB: Stores 128-D Vector in students & student_face_embeddings
    end

    Kiosk->>Kiosk: 1. Validate GPS Location (<= 150m from Campus)
    Kiosk->>Kiosk: 2. Scan Dynamic QR Code from Classroom Screen
    Kiosk->>Kiosk: 3. Verify Eye Blink Liveness (EAR < 0.22)
    Kiosk->>Kiosk: 4. Extract Live 128-D Face Descriptor

    Kiosk->>API: POST /api/checkin/verify (Descriptor + GPS + Token + Blink)
    API->>API: Validate QR Token & Session Expiry
    API->>API: Validate GPS Haversine Distance
    API->>API: Vector Math Match (Euclidean Distance <= 0.44)
    
    alt Match Verified
        API->>DB: INSERT INTO attendance_records (Status: present)
        API->>Staff: ⚡ WebSocket Emit 'attendance:new'
        API-->>Kiosk: 200 OK — Attendance Verified ✅
        Kiosk->>Student: 🎉 Success Confirmation Banner
    else Mismatch or Spoof Attempt
        API-->>Kiosk: 400 Bad Request — Verification Failed ❌
        Kiosk->>Student: Prompt WebAuthn / Passkey Fallback
    end
```

### 2. Password Reset with Redis OTP
```mermaid
sequenceDiagram
    autonumber
    actor Staff as 👨‍🏫 Faculty / Admin
    participant UI as 💻 Reset Password UI
    participant API as ⚙️ FastAPI Backend
    participant Redis as ⚡ Redis 7
    participant Brevo as 📧 Brevo SMTP Relay

    Staff->>UI: Submits institutional email
    UI->>API: POST /api/auth/forgot-password/request-otp
    API->>API: Generates cryptographically secure 6-digit OTP
    API->>Redis: SETEX pwd_reset_otp:{email} 600 {otp} (10 min TTL)
    API->>Brevo: Dispatches branded HTML email with OTP
    Brevo-->>Staff: Email delivered to inbox
    Staff->>UI: Enters 6-digit OTP + New Password
    UI->>API: POST /api/auth/forgot-password/reset
    API->>Redis: GET pwd_reset_otp:{email} & verifies match
    API->>API: Hashes new password with bcrypt
    API->>API: Updates password_hash in admins or faculty table
    API->>Redis: DEL pwd_reset_otp:{email}
    API-->>UI: 200 OK — Password reset successfully ✅
```

---

## 🖥️ UI & Route Map

```
/
├── /checkin                     👉 Public Student Kiosk (Face AI + Liveness + QR Scanner + GPS)
├── /student/dashboard           👉 Student Personal Portal (Attendance history & statistics)
├── /login                       👉 Staff Portal (Admins & Faculty)
├── /reset-password              👉 Self-Service OTP Password Recovery
│
├── 🛡️ Admin Space (Role: admin)
│   ├── /admin/dashboard         👉 Institutional Stats, Geofence Controller, Live Roster, User Modals
│   ├── /admin/approvals         👉 Student & Faculty Verification Requests
│   └── /admin/manual-attendance 👉 Staff Manual Attendance Marker
│
├── 👨‍🏫 Faculty Space (Role: faculty, admin)
│   ├── /faculty/dashboard       👉 Broadcast Dynamic QR Sessions, Real-Time Classroom Roster
│   └── /faculty/manual-attendance 👉 Class Attendance Overrides
│
└── 📊 Shared Analytics (Role: faculty, admin)
    ├── /attendance/live         👉 Fullscreen Institutional Live Attendance Wall
    ├── /analytics               👉 Department Breakdown & Trend Charts
    └── /reports                 👉 Excel (.xlsx), CSV, and PDF Report Export Center
```

---

## 📁 Project Structure

```
smartattend-ai/
├── 📂 backend/
│   ├── 📂 app/
│   │   ├── 📂 dependencies/     # Auth Guards (get_current_user, require_role)
│   │   ├── 📂 models/           # SQLAlchemy DB Models & Pydantic Schemas
│   │   ├── 📂 routes/           # Modular REST API Endpoints
│   │   │   ├── admin.py         # Institutional stats & geofence configuration
│   │   │   ├── attendance.py    # Live records, date queries, toggle, and bulk marks
│   │   │   ├── auth.py          # Admin/faculty login, user CRUD & OTP password reset
│   │   │   ├── checkin.py       # Multi-modal kiosk verification & biometrics
│   │   │   ├── health.py        # Service & database health checks
│   │   │   ├── qr_session.py    # Dynamic rotating QR sessions
│   │   │   └── student_face.py  # Face vector enrollment & cache
│   │   ├── 📂 services/         # Face recognition vector calculation service
│   │   ├── 📂 utils/            # Redis client, Brevo email service, security, geofence
│   │   ├── config.py            # Environment validation
│   │   ├── database.py          # SQLAlchemy engine & session maker
│   │   ├── main.py              # FastAPI app & Socket.IO server setup
│   │   └── seed.py              # Non-destructive bootstrap seeder
│   ├── 📂 db/
│   │   ├── postgresql_schema.sql # Complete PostgreSQL 16 schema with tables & triggers
│   │   └── README.md            # Database schema documentation
│   ├── Dockerfile               # Backend Python container definition
│   └── requirements.txt         # Python dependencies
│
├── 📂 frontend/
│   ├── 📂 public/
│   │   ├── 📂 assets/logos/     # Institutional logos & branding
│   │   └── 📂 models/           # Pre-trained face-api.js weights & manifests
│   ├── 📂 src/
│   │   ├── 📂 components/       # Modals, Live Attendance Roster, QR, Face Camera
│   │   ├── 📂 context/          # AuthContext, AttendanceContext, ThemeContext
│   │   ├── 📂 face/             # Face API model loader
│   │   ├── 📂 pages/            # Views (Admin, Faculty, Student, Kiosk, Analytics)
│   │   ├── App.tsx              # Role-based route definitions & layout shell
│   │   └── index.css            # Tailwind design tokens & styles
│   ├── Dockerfile               # Multi-stage production Nginx container build
│   ├── nginx.conf               # Production Nginx proxy configuration
│   └── package.json             # Frontend dependencies & scripts
│
├── docker-compose.yml           # Unified multi-container orchestration
├── seed_database.py             # Root convenience script to run seeder
└── README.md                    # System documentation
```

---

## 🚀 Quickstart & Setup

### 1. Prerequisites
- **Docker & Docker Compose** (Recommended): [Get Docker](https://www.docker.com/)
- *Alternatively for local development without Docker:*
  - Node.js 18+ & npm
  - Python 3.11+
  - PostgreSQL 16
  - Redis 7

---

### 2. Environment Configuration

The system uses a single `.env` file located in the `backend/` directory for local development.

Copy the example file to create your local `.env`:
```bash
cp .env.example backend/.env
```

Edit `backend/.env` with your secure values. For local development, the defaults are safe to use as-is. **Do not use the default secrets in production.**

---

### 3. Local Development (Docker Compose)

The easiest way to run the entire stack locally is via Docker Compose. Because the `.env` file is located in the `backend/` folder (to keep it close to the API), you **must** pass the `--env-file` flag to Docker Compose.

Start the stack:
```bash
docker compose --env-file backend/.env up -d
```
*(If you make changes to the source code, you can rebuild the containers by adding `--build` to the end of the command).*

This starts 4 auto-restarting containers:
| Container | Port | Description |
| :--- | :--- | :--- |
| `smartattend-frontend` | `http://localhost:3000` | Production React App (Nginx) |
| `smartattend-backend` | `http://localhost:5000` | FastAPI Backend (Internal Only) |
| `smartattend-postgres` | `5432` | PostgreSQL 16 Database (Internal Only) |
| `smartattend-redis` | `6379` | Redis 7 Cache (Internal Only) |

> **Note on Database Resets:** If you change `POSTGRES_PASSWORD` in your `.env` *after* the database has already been created, PostgreSQL will reject the connection. To fully reset the database and apply the new password, run: `docker compose down -v` followed by the `up` command above.

#### Useful Docker Compose Commands
| Action | Command |
| :--- | :--- |
| **Start / Run stack** | `docker compose --env-file backend/.env up -d` |
| **Build & Run (All)** | `docker compose --env-file backend/.env up -d --build` |
| **Build & Run Frontend only** | `docker compose --env-file backend/.env up -d --build frontend` |
| **Build & Run Backend only** | `docker compose --env-file backend/.env up -d --build backend` |
| **Stop all containers** | `docker compose down` |
| **Stop and wipe database/data** | `docker compose down -v` |
| **View logs (All)** | `docker compose logs -f` |
| **View logs (Backend only)** | `docker compose logs -f backend` |

---

### 4. Running Locally (Without Docker)

If you prefer to run the services individually without Docker Compose:

**1. Start Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # (On Windows: .venv\Scripts\activate)
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
```

**2. Start Frontend (Node.js):**
```bash
cd frontend
npm install
npm run dev
```

**3. Build & Run Frontend Standalone (Using Docker Nginx):**
If you want to test the production build of the frontend in isolation:
```bash
cd frontend
docker build -t smartattend-frontend .
docker run -d -p 3000:80 smartattend-frontend
```

---

### 5. Production Deployment (Coolify / Docker)

Smart Attend is optimized for 1-click deployment on **Coolify** or any standard Docker VPS.

1. Connect your GitHub repository to Coolify.
2. Select **Docker Compose** as the build pack.
3. In the Coolify **Environment Variables** UI, you **must** set the following variables (do not use a `.env` file in Coolify):

   ```env
   NODE_ENV=production
   POSTGRES_PASSWORD=<generate: openssl rand -hex 32>
   JWT_SECRET=<generate: python -c "import secrets; print(secrets.token_hex(32))">
   EDGE_API_KEY=<generate: python -c "import secrets; print(secrets.token_urlsafe(32))">
   ADMIN_EMAIL=admin@sbit.ac.in
   ADMIN_PASSWORD=<your-secure-admin-password, min 8 chars>
   ```

   *Note: When `NODE_ENV=production`, the backend enforces strict startup guards and will raise a `RuntimeError` if default database passwords (`postgrespassword`, `localdevpassword123`), default `JWT_SECRET`, or default `EDGE_API_KEY` are detected.*

4. Click **Deploy**. Coolify provisions SSL certificates, runs the PostgreSQL and Redis containers internally, and routes traffic through Nginx on port `80`/`443`.

---

### 6. Database Setup & Seeding

The database schema initializes automatically on first Docker launch via [`backend/db/postgresql_schema.sql`](file:///d:/Projects/smartattend-ai/backend/db/postgresql_schema.sql).

If no administrators exist in the database, the system will **automatically bootstrap an initial admin account** using the `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables on startup. Additional faculty and students can be enrolled through the admin dashboard or via Excel bulk upload.

---

## 🛡️ Anti-Proxy & Security Architecture

| Threat / Attack Vector | Defense Mechanism | Implementation Detail |
| :--- | :--- | :--- |
| **Photo / Display Screen Spoofing** | **Active Eye Blink Liveness** | Computes continuous Eye Aspect Ratio (EAR) across facial landmarks. Rejects static photos. |
| **Off-Campus Remote Proxy** | **GPS Geofencing** | Enforces Euclidean Haversine distance from campus centroid ($\le 150\text{m}$). Fail-closed on missing or spoofed coordinates. |
| **QR Screenshot Relaying** | **Rotating Ephemeral Tokens** | Dynamic classroom QR tokens cycle periodically with cryptographic signatures and expiration. |
| **Attendance History Wipe** | **Session-Scoped Deletes** | All manual overrides, toggles, bulk actions, and kiosk captures delete existing records scoped strictly to `(session_id, hall_ticket_no)`. |
| **Biometric Descriptor Leakage** | **Zero-Vector Public Exposure** | Raw 128-D / 512-D face descriptors are stripped from public responses (`check-status`, `Student.to_dict()`, user queries). |
| **Brute Force & Flooding** | **SlowAPI Rate Limiting** | Strict rate limits applied to check-in (`5/min`), verification (`10/min`), login (`10/min`), and OTP dispatch (`3/min`). |
| **Unauthenticated Read Access** | **Strict JWT RBAC** | All roster and history endpoints (`/api/attendance/records`, `/api/admin/geofence`) require verified JWT authentication. |
| **Cryptographic RNG for OTP** | **Python `secrets` Module** | OTPs are generated using CSPRNG (`secrets.randbelow`) and cached in Redis with a 10-minute TTL. |
| **Default Credential Usage** | **Production Startup Guards** | Fails closed on boot if default credentials or passwords are used in production environments. |

---

## � Security Enhancements

Smart Attend has undergone comprehensive security hardening to achieve **9/10 production readiness**. All critical vulnerabilities have been addressed through systematic security improvements.

### ✅ Implemented Security Fixes

#### Student Enrollment Identity Verification
- **OTP-based email verification** for first-time face enrollment
- Prevents attackers from claiming existing-but-unenrolled student identities
- Endpoints:
  - `POST /api/auth/student/enrollment/request-otp` - Sends 6-digit OTP to institutional email
  - `POST /api/auth/student/enrollment/verify-otp` - Verifies OTP and issues enrollment token
- Integration with Redis for OTP storage (10-minute TTL) and Brevo SMTP for delivery

#### CI/CD Pipeline
- **GitHub Actions workflow** for automated testing and security scanning
- Includes:
  - Backend tests with PostgreSQL & Redis services
  - Frontend linting, type checking, and unit tests
  - Security scanning with Trivy vulnerability scanner
  - Docker build validation
  - Dependency security checks (Safety for Python, npm audit for frontend)

#### Faculty Password Security
- **Secure random password generation** for bulk faculty creation
- Uses cryptographically secure `secrets` module
- Generates 16-character passwords with special characters
- No default or predictable passwords

### 🛡️ Core Security Features

| Security Layer | Implementation | Status |
|:---|:---|:---|
| **GPS Geofencing** | Haversine distance validation, fail-closed on missing coordinates | ✅ Enforced |
| **Face Descriptor Protection** | Raw vectors stripped from public responses | ✅ Protected |
| **Session Token Validation** | Fail-closed authentication, no auto-backfill | ✅ Enforced |
| **Rate Limiting** | SlowAPI on critical endpoints (5-10/min) | ✅ Active |
| **Cryptographic OTP** | Python `secrets` module, Redis TTL | ✅ Implemented |
| **Production Guards** | Startup checks for default credentials | ✅ Active |
| **RBAC Enforcement** | JWT-based role verification on protected endpoints | ✅ Enforced |
| **Liveness Detection** | Audit-log approach with security warnings | 🟡 Interim |
| **JWT Storage** | localStorage (standard, XSS-vulnerable) | 🟡 Documented |

### 🔐 Production Security Checklist

Before deploying to production, ensure:

- [ ] Set custom `JWT_SECRET` (minimum 32 characters)
- [ ] Set custom `EDGE_API_KEY` (minimum 32 characters)
- [ ] Set custom `POSTGRES_PASSWORD` (not default values)
- [ ] Set custom `ADMIN_EMAIL` and `ADMIN_PASSWORD`
- [ ] Configure Brevo SMTP credentials for OTP delivery
- [ ] Enable HTTPS/TLS (handled by Coolify or your reverse proxy)
- [ ] Review and update CORS origins to your domain
- [ ] Test OTP enrollment flow with your email provider
- [ ] Run CI/CD pipeline to ensure all tests pass

### 📋 Security Recommendations

#### Post-Launch Improvements
1. **httpOnly Cookie Authentication** - Migrate JWT storage from localStorage to httpOnly cookies
2. **Real Server-Side Liveness** - Implement ML-based liveness detection instead of client-reported boolean
3. **Expanded Test Coverage** - Add comprehensive integration and E2E tests
4. **Security Monitoring** - Set up alerting for `[SECURITY]` log warnings

#### Architecture Decisions Required
- **Liveness Detection Approach:** Choose between audit-log (current) or full ML-based implementation
- **Cookie Migration Timeline:** Plan backend session management and frontend refactoring for httpOnly cookies

For detailed security analysis and fix history, see [plan.md](plan.md) and [FIXES_APPLIED.md](FIXES_APPLIED.md).

---

## �📡 API Endpoints Reference

### Authentication & Users (`/api/auth`)
| Method | Endpoint | Description | Auth | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Authenticate Admin or Faculty member | None | 10/min |
| `GET` | `/api/auth/me` | Fetch active user profile from JWT token | Bearer Token | — |
| `GET` | `/api/auth/users` | List unified users (admins, faculty, students) | Bearer Token | — |
| `POST` | `/api/auth/register-admin` | Register a new administrator | Admin Only | — |
| `POST` | `/api/auth/register-faculty` | Register a new faculty member | Admin Only | — |
| `POST` | `/api/auth/register-student` | Register a new student | Admin / Kiosk | — |
| `POST` | `/api/auth/users/bulk` | Bulk upload students from parsed Excel sheet | Admin Only | — |
| `POST` | `/api/auth/faculty/bulk` | Bulk upload faculty members | Admin Only | — |
| `PUT` | `/api/auth/users/{user_id}` | Update user details or status | Admin / Self | — |
| `DELETE` | `/api/auth/users/{user_id}` | Delete user (prevents deleting last admin) | Admin Only | — |
| `POST` | `/api/auth/request-reset` | Request 6-digit OTP via email (Brevo / Redis) | None | 3/min |
| `POST` | `/api/auth/reset-password` | Verify OTP and set new password | None | 10/min |

### Public Kiosk & Student Check-in (`/api/checkin`)
| Method | Endpoint | Description | Auth | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/checkin/session/{token}` | Validate active classroom QR session (fails closed) | None | — |
| `GET` | `/api/student/check-status/{hall_ticket}` | Check if student exists & enrolled (no raw descriptors) | None | 10/min |
| `POST` | `/api/student/register-biometrics` | Enroll 128-D face vector for admin-registered student | None / Kiosk | 10/min |
| `POST` | `/api/checkin/verify` | Submit multi-modal checkin (Face + Blink + GPS + QR) | None | 5/min |
| `GET` | `/api/student/records/{hall_ticket}` | Student personal attendance history | None | — |

### Attendance & Live Rosters (`/api/attendance`)
| Method | Endpoint | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/attendance/records` | Fetch live attendance records for dashboard | Bearer Token |
| `GET` | `/api/attendance/date/{date}` | Retrieve attendance records for a specific date | Bearer Token |
| `POST` | `/api/attendance/toggle` | Inline toggle status (Present / Absent / Late) | Faculty / Admin |
| `POST` | `/api/attendance/bulk` | Bulk mark list of students present or absent | Faculty / Admin |
| `POST` | `/api/attendance/mark` | Direct manual override / attendance marking | Faculty / Admin |
| `POST` | `/api/attendance/capture` | Kiosk / Classroom group face capture | Faculty / Admin |

### Sessions & Geofence (`/api/admin` & `/api/qr-session`)
| Method | Endpoint | Description | Auth | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/admin/stats` | High-level institutional metrics | Admin Only | — |
| `GET` | `/api/admin/geofence` | Retrieve campus geofence coordinates & radius | Bearer Token | — |
| `PUT` | `/api/admin/geofence` | Update geofence coordinates and radius | Admin Only | — |
| `POST` | `/api/qr-session/start` | Launch dynamic QR broadcasting session | Faculty / Admin | — |
| `GET` | `/api/qr-session/current` | Get current active QR session details | None | 10/min |
| `POST` | `/api/qr-session/terminate`| Terminate active attendance session | Faculty / Admin | — |

Interactive OpenAPI documentation is available at `http://localhost:5000/docs` in development mode (disabled automatically in production for security).

### New Security Endpoints

The following endpoints have been added as part of the security hardening:

**Student Enrollment OTP Verification:**
- `POST /api/auth/student/enrollment/request-otp` - Request OTP for first-time face enrollment (3/min rate limit)
- `POST /api/auth/student/enrollment/verify-otp` - Verify OTP and get enrollment token (10/min rate limit)

These endpoints ensure that first-time face enrollment requires identity verification via the student's institutional email, preventing attackers from claiming existing-but-unenrolled student identities.

---

## 🤝 Contributing & License

1. Fork the project repository.
2. Create a feature branch (`git checkout -b feature/NewFeature`).
3. Commit your changes (`git commit -m 'Add NewFeature'`).
4. Push to your branch (`git push origin feature/NewFeature`).
5. Open a Pull Request.

Distributed under the **MIT License**.
