# 📡 SmartAttend AI — Backend API Documentation

> **Interactive API Explorer:**
> - Swagger UI: `http://localhost:5000/docs`
> - ReDoc UI: `http://localhost:5000/redoc`
> - Base URL: `http://localhost:5000`

---

## 📋 Table of Contents

1. [System Architecture & Overview](#1-system-architecture--overview)
2. [Authentication & Security](#2-authentication--security)
3. [Quick Reference Matrix](#3-quick-reference-matrix)
4. [API Endpoints by Module](#4-api-endpoints-by-module)
   - [4.1 System & Health](#41-system--health)
   - [4.2 Authentication & Password Management](#42-authentication--password-management)
   - [4.3 Student Profile & Biometric Enrollment](#43-student-profile--biometric-enrollment)
   - [4.4 Dynamic QR Attendance Sessions](#44-dynamic-qr-attendance-sessions)
   - [4.5 Public Check-in & Verification](#45-public-check-in--verification)
   - [4.6 Attendance Records & Live Roster](#46-attendance-records--live-roster)
   - [4.7 Admin Portal & Geofencing](#47-admin-portal--geofencing)
   - [4.8 Edge Device AI PC Sync](#48-edge-device-ai-pc-sync)
5. [Real-Time WebSocket Events (Socket.io)](#5-real-time-websocket-events-socketio)
6. [Data Validation Rules](#6-data-validation-rules)
7. [Error Handling & Status Codes](#7-error-handling--status-codes)

---

## 1. System Architecture & Overview

SmartAttend AI is built on **FastAPI (Python 3.10+)** with native vectorized **NumPy** face matching, PostgreSQL/Supabase data persistence, and **Socket.io** for real-time live attendance streaming.

```
┌────────────────────────────────────────────────────────┐
│               FastAPI Application Layer                │
├───────────────┬────────────────────────┬───────────────┤
│   REST APIs   │ NumPy Face Vector AI   │   Socket.io   │
│  (Auth, Admin,│  (128-D & 512-D cosine │  (Live Stream │
│  Attendance)  │  & Euclidean matching) │   to Faculty) │
└───────┬───────┴───────────┬────────────┴───────┬───────┘
        │                   │                    │
┌───────▼───────────────────▼────────────────────▼───────┐
│              PostgreSQL / Supabase Database             │
│ (users, attendance_records, sessions, capture_logs)    │
└────────────────────────────────────────────────────────┘
```

---

## 2. Authentication & Security

The API uses three authorization schemes:

| Scheme | Header | Description |
| :--- | :--- | :--- |
| **Bearer Token (JWT)** | `Authorization: Bearer <token>` | User session token returned on `/api/auth/login`. Required for protected routes. |
| **Edge API Key** | `X-API-Key: <key>` | Dedicated key for offline Edge AI PC sync (`/api/embeddings/sync`). |
| **Public Endpoints** | *None required* | Used for student QR scanning, kiosk check-in, and health probes. |

### Role Hierarchy

- **`admin`**: Full platform control (stats, user management, geofence updates).
- **`faculty`**: Start QR sessions, mark manual attendance, override records, review logs.
- **`student`**: View self-attendance history, enroll/revoke personal face biometrics.

---

## 3. Quick Reference Matrix

| Method | Endpoint | Access | Purpose |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/health` | Public | System status and health check |
| **GET** | `/api/auth/users` | Public | List all users for client cache sync |
| **POST** | `/api/auth/login` | Public | Authenticate user & issue JWT |
| **POST** | `/api/auth/request-reset` | Public | Request 6-digit OTP for password reset |
| **POST** | `/api/auth/reset-password` | Public | Verify OTP code & set new password |
| **POST** | `/api/auth/admin-direct-reset` | Admin | Administrative direct password update |
| **POST** | `/api/students/{id}/enroll-face` | Student / Admin | Enroll face embedding vector with consent |
| **PUT** | `/api/students/{id}/face` | Student / Admin | Update enrolled face embedding |
| **DELETE**| `/api/students/{id}/face` | Student / Admin | Revoke & delete face data (Right to Erasure) |
| **POST** | `/api/qr-session/start` | Faculty / Admin| Start/refresh live dynamic QR session |
| **GET** | `/api/qr-session/current` | Public | Poll active QR session & remaining seconds |
| **GET** | `/api/checkin/session/{token}`| Public | Validate QR token & retrieve session info |
| **GET** | `/api/student/check-status/{ht}`| Public | Check registration & enrollment status |
| **POST** | `/api/student/register-biometrics` | Public | Self-service biometric registration |
| **POST** | `/api/student/reset-biometrics/{ht}` | Public | Reset biometric profile for re-capture |
| **GET** | `/api/student/records/{ht}` | Public | Get complete attendance history & stats |
| **POST** | `/api/checkin/verify` | Public | Verify face, GPS & blink for live check-in |
| **GET** | `/api/attendance/today` | Public | Get today's attendance records |
| **GET** | `/api/attendance/records` | Public / Faculty| Get all recent attendance records |
| **GET** | `/api/attendance/date/{date}`| Public / Faculty| Get attendance & capture logs by date |
| **POST** | `/api/attendance/capture` | Optional Auth | Unified WebRTC Kiosk / Group Scan capture |
| **PATCH**| `/api/attendance/{id}/override`| Faculty / Admin| Manual status override with audit reason |
| **POST** | `/api/attendance/toggle` | Faculty / Admin| Inline roster toggle (Present/Late/Absent) |
| **POST** | `/api/attendance/bulk` | Faculty / Admin| Bulk mark attendance for student list |
| **POST** | `/api/attendance/mark` | Faculty / Admin| Direct single attendance record creation |
| **POST** | `/api/attendance/verify-face`| Authenticated | Compare 2 face vectors directly |
| **GET** | `/api/admin/stats` | Admin | Platform overview counts & status |
| **GET** | `/api/admin/geofence` | Admin | Read current campus GPS coordinates & radius |
| **PUT** | `/api/admin/geofence` | Admin | Update campus GPS coordinates & radius |
| **POST** | `/api/admin/clear-all-biometrics`| Admin | Clear all biometrics across database & cache |
| **GET** | `/api/embeddings/sync` | Edge Key | Sync registered face embeddings to Edge PC |

---

## 4. API Endpoints by Module

### 4.1 System & Health

#### `GET /api/health`
Checks server uptime and service status.

- **Access:** Public
- **Response (200 OK):**
```json
{
  "status": "online",
  "service": "Smart Attend FastAPI Backend",
  "version": "2.0.0",
  "timestamp": "2026-09-02T08:30:00.000000Z"
}
```

---

### 4.2 Authentication & Password Management

#### `GET /api/auth/users`
Fetches all user profiles from the database to synchronize frontend user lists.

- **Access:** Public
- **Response (200 OK):**
```json
{
  "success": true,
  "users": [
    {
      "id": "u123",
      "email": "faculty@sbit.ac.in",
      "name": "Dr. Ramesh Kumar",
      "role": "faculty",
      "branch": "CSE"
    }
  ]
}
```

---

#### `POST /api/auth/login`
Authenticates a user via credentials, verifies role permissions, and returns an institutional JWT token.

- **Access:** Public
- **Request Body:**
```json
{
  "email": "faculty@sbit.ac.in",
  "password": "SecurePassword123!",
  "role": "faculty"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "uid": "a1b2c3d4-...",
    "email": "faculty@sbit.ac.in",
    "name": "Dr. Ramesh Kumar",
    "role": "faculty",
    "department": "Computer Science & Engineering",
    "assignedBranch": "CSE",
    "assignedSections": ["A", "B"],
    "status": "approved"
  }
}
```

---

#### `POST /api/auth/request-reset`
Initiates a password reset workflow by generating a 10-minute 6-digit OTP code and sending a recovery email.

- **Access:** Public
- **Request Body:**
```json
{
  "email": "student@sbit.ac.in"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Password reset verification code generated.",
  "email": "student@sbit.ac.in",
  "otp_code": "492815",
  "expires_in_seconds": 600
}
```

---

#### `POST /api/auth/reset-password`
Verifies the 6-digit OTP code and updates the account password in the authentication system.

- **Access:** Public
- **Request Body:**
```json
{
  "email": "student@sbit.ac.in",
  "otp": "492815",
  "new_password": "NewSecretPassword2026!"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Password successfully updated! You can now log in with your new password."
}
```

---

#### `POST /api/auth/admin-direct-reset`
Allows an administrator to directly overwrite a user's password without OTP verification.

- **Access:** Admin
- **Request Body:**
```json
{
  "email": "user@sbit.ac.in",
  "new_password": "TemporaryPassword123"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Password for user@sbit.ac.in updated successfully."
}
```

---

### 4.3 Student Profile & Biometric Enrollment

#### `POST /api/students/{student_id}/enroll-face`
Captures and registers the reference 128-D or 512-D face embedding vector with explicit student consent.

- **Access:** Authenticated (Student ownership check or Admin/Faculty)
- **Path Parameter:** `student_id` (e.g., `21SBIT0501` or UUID)
- **Request Body:**
```json
{
  "faceDescriptor": [0.042, -0.128, 0.089, "... (128 or 512 float values)"],
  "hallTicketNo": "21SBIT0501",
  "studentConsent": true,
  "algorithm": "facenet_128"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Face embedding registered successfully with verified student biometric consent.",
  "studentId": "21SBIT0501",
  "hallTicketNo": "21SBIT0501",
  "embeddingDim": 128,
  "faceEnrolledAt": "2026-09-02T08:35:00.000000Z"
}
```

---

#### `PUT /api/students/{student_id}/face`
Re-captures and updates an already enrolled face embedding.

- **Access:** Authenticated (Student ownership or Admin)
- **Request Body:**
```json
{
  "faceDescriptor": [0.051, -0.115, 0.092, "..."],
  "hallTicketNo": "21SBIT0501"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Face embedding updated successfully.",
  "studentId": "21SBIT0501",
  "faceEnrolledAt": "2026-09-02T08:40:00.000000Z"
}
```

---

#### `DELETE /api/students/{student_id}/face` (or `/revoke-face-data`)
Permanently deletes the stored face embedding and biometric descriptors from database and in-memory cache (Right-to-Erasure compliance).

- **Access:** Authenticated (Student ownership or Admin)
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Face biometric embedding permanently deleted and revoked from all matching services.",
  "studentId": "21SBIT0501"
}
```

---

### 4.4 Dynamic QR Attendance Sessions

#### `POST /api/qr-session/start`
Starts or refreshes a live dynamic QR attendance session with classroom GPS anchors.

- **Access:** Faculty or Admin
- **Request Body:**
```json
{
  "facultyId": "faculty_201",
  "facultyName": "Dr. Ramesh Kumar",
  "sessionTitle": "Data Structures & Algorithms - CSE A",
  "branch": "CSE",
  "section": "A",
  "room": "Innovation Centre Lab 304",
  "latitude": 17.2472,
  "longitude": 80.1514,
  "radiusMeters": 150
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "session": {
    "sessionId": "session_1788349200",
    "sessionTitle": "Data Structures & Algorithms - CSE A",
    "facultyName": "Dr. Ramesh Kumar",
    "branch": "CSE",
    "section": "A",
    "room": "Innovation Centre Lab 304",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
    "raw_token": "a4d3-e7f8-...",
    "expiresAt": 1788356400000
  },
  "checkinUrl": "/checkin?token=a4d3-e7f8-..."
}
```

---

#### `GET /api/qr-session/current`
Polls the currently active QR session. Used by classroom display screens to dynamically render rotating QR codes.

- **Access:** Public
- **Response (200 OK):**
```json
{
  "active": true,
  "session": {
    "sessionId": "session_1788349200",
    "sessionTitle": "Data Structures & Algorithms - CSE A",
    "facultyName": "Dr. Ramesh Kumar",
    "branch": "CSE",
    "section": "A",
    "room": "Innovation Centre Lab 304"
  },
  "secondsRemaining": 115,
  "checkinUrl": "/checkin?token=a4d3-e7f8-..."
}
```

---

### 4.5 Public Check-in & Verification

#### `GET /api/checkin/session/{token}`
Validates a scanned QR token (UUID or JWT) and returns classroom session details and geofence boundary coordinates.

- **Access:** Public
- **Response (200 OK):**
```json
{
  "valid": true,
  "session": {
    "sessionId": "session_1788349200",
    "sessionTitle": "Data Structures & Algorithms - CSE A",
    "facultyName": "Dr. Ramesh Kumar",
    "branch": "CSE",
    "section": "A",
    "room": "Innovation Centre Lab 304"
  },
  "geofence": {
    "centerLat": 17.2472,
    "centerLng": 80.1514,
    "radiusMeters": 150
  }
}
```

---

#### `GET /api/student/check-status/{hall_ticket}`
Checks if a student's Hall Ticket number (e.g. `21SBIT0501`) is enrolled for face attendance and whether attendance is already marked today.

- **Access:** Public
- **Response (200 OK):**
```json
{
  "hallTicketNo": "21SBIT0501",
  "isRegistered": true,
  "isFaceEnrolled": true,
  "isBiometricEnrolled": false,
  "isAlreadyMarked": false,
  "profile": {
    "name": "K. Rahul",
    "hallTicketNo": "21SBIT0501",
    "branch": "CSE",
    "section": "A",
    "year": 3
  }
}
```

---

#### `POST /api/student/register-biometrics`
Public self-service biometric enrollment for students on their own mobile devices. Protected against unauthorized face overrides.

- **Access:** Public
- **Request Body:**
```json
{
  "hallTicketNo": "21SBIT0501",
  "name": "K. Rahul",
  "branch": "CSE",
  "section": "A",
  "faceDescriptor": [0.042, -0.128, "... (128 floats)"],
  "biometricCredentialId": "optional-webauthn-id"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Biometrics successfully registered for 21SBIT0501. You are ready for fast face attendance!"
}
```

---

#### `POST /api/student/reset-biometrics/{hall_ticket}`
Clears a student's biometric cache and database status to allow clean re-enrollment.

- **Access:** Public
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Biometric profile reset for 21SBIT0501. You can now register a fresh face scan."
}
```

---

#### `GET /api/student/records/{hall_ticket}`
Retrieves a student's complete historical attendance records, attended/missed session counts, aggregate attendance percentage, and exam eligibility compliance status.

- **Access:** Public
- **Response (200 OK):**
```json
{
  "hallTicketNo": "21SBIT0501",
  "studentName": "K. Rahul",
  "branch": "CSE",
  "section": "A",
  "year": 3,
  "totalSessionsConducted": 40,
  "totalSessionsAttended": 36,
  "totalSessionsMissed": 4,
  "attendancePercentage": 90.0,
  "complianceStatus": "eligible",
  "complianceLabel": "Eligible for Exams (>= 75%)",
  "records": [
    {
      "id": "rec-1",
      "session_id": "sess-1",
      "status": "present",
      "verification_method": "face_recognition",
      "face_match_confidence": 0.94,
      "marked_at": "2026-09-02T08:32:00Z"
    }
  ]
}
```

---

#### `POST /api/checkin/verify`
The primary check-in submission endpoint. Executes 4-tier security validation:
1. Validates session token.
2. Checks for duplicate check-ins in the current session.
3. Enforces GPS Haversine distance within geofence radius.
4. Matches live face embedding against enrolled descriptor & verifies eye blink liveness.

- **Access:** Public
- **Request Body:**
```json
{
  "token": "session-uuid-or-raw-token",
  "hallTicket": "21SBIT0501",
  "studentName": "K. Rahul",
  "lat": 17.24722,
  "lng": 80.15141,
  "faceDescriptor": [0.043, -0.126, "... (128 floats)"],
  "blinkVerified": true,
  "biometricVerified": false
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Attendance marked successfully for 21SBIT0501!",
  "record": {
    "id": "d1c2b3a4-...",
    "sessionId": "session_1788349200",
    "studentName": "K. Rahul",
    "hallTicketNo": "21SBIT0501",
    "branch": "CSE",
    "section": "A",
    "year": 3,
    "markedAt": "2026-09-02T08:42:15.123Z",
    "status": "present",
    "verificationMethod": "face_recognition",
    "faceMatchConfidence": 0.94,
    "faceDistance": 0.12,
    "blinkVerified": true,
    "distanceM": 4.2
  }
}
```

---

### 4.6 Attendance Records & Live Roster

#### `GET /api/attendance/today`
Returns all attendance records marked today (UTC date filter with fallback).

- **Access:** Public / Dashboard
- **Response (200 OK):**
```json
{
  "count": 48,
  "records": [
    {
      "id": "rec-1",
      "hall_ticket_no": "21SBIT0501",
      "student_name": "K. Rahul",
      "status": "present",
      "verification_method": "face_recognition",
      "marked_at": "2026-09-02T08:32:00Z"
    }
  ]
}
```

---

#### `GET /api/attendance/records`
Fetches the last 500 attendance records from PostgreSQL/Supabase.

- **Access:** Public / Faculty
- **Response (200 OK):**
```json
{
  "success": true,
  "count": 500,
  "records": [...]
}
```

---

#### `GET /api/attendance/date/{target_date}`
Fetches attendance records and detailed biometric capture logs for a specific calendar date (`YYYY-MM-DD`).

- **Access:** Public / Faculty
- **Path Parameter:** `target_date` (Format: `YYYY-MM-DD`, e.g. `2026-09-02`)
- **Response (200 OK):**
```json
{
  "success": true,
  "date": "2026-09-02",
  "summary": {
    "totalMarked": 55,
    "presentCount": 50,
    "lateCount": 5,
    "absentCount": 0,
    "captureLogsCount": 60
  },
  "records": [...],
  "captureLogs": [...]
}
```

---

#### `POST /api/attendance/capture`
Unified facial recognition capture endpoint supporting:
1. **Single-student WebRTC Kiosk** capture.
2. **Multi-face Classroom Group Scan** (simultaneous batch recognition with bounding boxes).

- **Access:** Optional Auth (Kiosk / Faculty)
- **Request Body (Classroom Group Scan):**
```json
{
  "source": "classroom_group_scan",
  "sessionId": "session_1788349200",
  "detectedFaces": [
    {
      "descriptor": [0.042, -0.128, "..."],
      "boundingBox": { "x": 120, "y": 80, "width": 150, "height": 180 },
      "livenessScore": 0.98
    },
    {
      "descriptor": [-0.012, 0.095, "..."],
      "boundingBox": { "x": 350, "y": 90, "width": 140, "height": 175 },
      "livenessScore": 0.95
    }
  ],
  "lat": 17.2472,
  "lng": 80.1514
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "mode": "classroom_group_scan",
  "totalDetectedFaces": 2,
  "matchedCount": 2,
  "results": [
    {
      "faceIndex": 0,
      "matched": true,
      "hallTicket": "21SBIT0501",
      "studentName": "K. Rahul",
      "confidencePct": 94,
      "boundingBox": { "x": 120, "y": 80, "width": 150, "height": 180 },
      "status": "present"
    }
  ]
}
```

---

#### `PATCH /api/attendance/{record_id}/override`
Allows teachers or administrators to modify a student's attendance status (`present`, `late`, `absent`) with mandatory audit justification. Emits real-time update to all connected dashboards.

- **Access:** Faculty or Admin
- **Request Body:**
```json
{
  "status": "present",
  "reason": "Verified present in lab room after connectivity issue",
  "reviewedBy": "faculty@sbit.ac.in"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Attendance record successfully updated to PRESENT.",
  "recordId": "rec-123",
  "status": "present",
  "overrideReason": "Verified present in lab room after connectivity issue"
}
```

---

#### `POST /api/attendance/toggle`
Inline one-click roster toggle to change a student's status between `present`, `late`, and `absent`.

- **Access:** Faculty or Admin
- **Request Body:**
```json
{
  "hallTicketNo": "21SBIT0501",
  "status": "late",
  "sessionId": "session_1788349200",
  "name": "K. Rahul",
  "branch": "CSE",
  "section": "A"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Marked 21SBIT0501 as LATE.",
  "record": { "id": "uuid", "status": "late" }
}
```

---

#### `POST /api/attendance/bulk`
Bulk marks an array of students as `present`, `late`, or `absent`.

- **Access:** Faculty or Admin
- **Request Body:**
```json
{
  "sessionId": "session_1788349200",
  "status": "present",
  "students": [
    { "hallTicketNo": "21SBIT0501", "name": "K. Rahul", "branch": "CSE", "section": "A" },
    { "hallTicketNo": "21SBIT0502", "name": "P. Sneha", "branch": "CSE", "section": "A" }
  ]
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Bulk marked 2 students as PRESENT."
}
```

---

#### `POST /api/attendance/mark`
Direct manual attendance recording by faculty.

- **Access:** Faculty or Admin
- **Request Body:**
```json
{
  "sessionId": "session_1788349200",
  "studentId": "21SBIT0501",
  "hallTicketNo": "21SBIT0501",
  "studentName": "K. Rahul",
  "branch": "CSE",
  "section": "A",
  "year": 3,
  "status": "present",
  "verificationMethod": "manual",
  "manualReason": "Student verified by faculty"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Attendance recorded via manual",
  "record": { "id": "uuid", "status": "present" }
}
```

---

#### `POST /api/attendance/verify-face`
Direct vector similarity check comparing two 128-D or 512-D float vectors using calibrated Euclidean thresholds.

- **Access:** Authenticated
- **Request Body:**
```json
{
  "enrolledDescriptor": [0.042, -0.128, "..."],
  "liveDescriptor": [0.044, -0.125, "..."],
  "blinkVerified": true
}
```
- **Response (200 OK):**
```json
{
  "match": true,
  "distance": 0.1245,
  "confidencePct": 94,
  "blinkVerified": true,
  "message": "Face verified with 94% confidence and confirmed Eye Blink liveness."
}
```

---

### 4.7 Admin Portal & Geofencing

#### `GET /api/admin/stats`
Retrieves platform statistics for the Admin dashboard.

- **Access:** Admin
- **Response (200 OK):**
```json
{
  "totalUsers": 120,
  "totalStudents": 105,
  "totalFaculty": 12,
  "pendingApprovals": 3,
  "totalSessions": 45,
  "totalRecords": 1820,
  "serverTime": "2026-09-02T08:50:00.000000Z"
}
```

---

#### `GET /api/admin/geofence`
Reads current campus center latitude, longitude, and allowed radius.

- **Access:** Admin
- **Response (200 OK):**
```json
{
  "success": true,
  "geofence": {
    "center_lat": 17.2472,
    "center_lng": 80.1514,
    "radius_m": 500
  }
}
```

---

#### `PUT /api/admin/geofence`
Updates campus GPS anchor coordinates and allowed radius.

- **Access:** Admin
- **Request Body:**
```json
{
  "center_lat": 17.24725,
  "center_lng": 80.15145,
  "radius_m": 300
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Geofencing parameters updated successfully.",
  "geofence": {
    "center_lat": 17.24725,
    "center_lng": 80.15145,
    "radius_m": 300
  }
}
```

---

#### `POST /api/admin/clear-all-biometrics`
Purges all registered face embeddings across database and in-memory caches.

- **Access:** Admin
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "All previous biometric details cleared. All registrations are now fresh."
}
```

---

### 4.8 Edge Device AI PC Sync

#### `GET /api/embeddings/sync`
Returns all registered student face embeddings to cache locally on an offline Edge AI PC.

- **Access:** Protected by `X-API-Key` header
- **Header:** `X-API-Key: <EDGE_API_KEY>`
- **Response (200 OK):**
```json
{
  "count": 105,
  "timestamp": "2026-09-02T08:55:00.000000Z",
  "embeddings": [
    {
      "studentId": "21SBIT0501",
      "faceDescriptor": [0.042, -0.128, "... (128 floats)"],
      "updatedAt": "2026-09-02T08:35:00.000000Z"
    }
  ]
}
```

---

## 5. Real-Time WebSocket Events (Socket.io)

SmartAttend AI embeds a **Socket.io ASGI server** for real-time bi-directional streaming.

### Connection
- **URL:** `ws://localhost:5000/socket.io/`
- **Transport:** WebSocket / Polling fallback

### Server-to-Client Broadcast Events

| Event Name | Payload Summary | Trigger |
| :--- | :--- | :--- |
| `attendance:new` | `{ id, name, hallTicket, department, status, timestamp, method, confidence }` | Emitted whenever a student completes check-in or is marked present. |
| `attendance:update` | `{ id, hallTicket, status, manualReason, performer }` | Emitted when faculty/admin manually overrides attendance status. |
| `attendance:delete` | `{ hallTicket, studentId }` | Emitted when a student record is removed or toggled to absent. |
| `attendance:group_scan` | `{ totalFaces, matchedCount, results }` | Emitted when a multi-face classroom scan is processed. |

---

## 6. Data Validation Rules

1. **Hall Ticket Format:**
   - Must be exactly **10 alphanumeric characters** starting with digit `2` (e.g. `21SBIT0501`, `23CSM0102`).
   - Validated via regex: `^2[0-9A-Z]{9}$`.

2. **Face Descriptors:**
   - Must be a `float[]` list of length **128** (face-api.js) or **512** (ArcFace / InsightFace).
   - Vectors are L2-normalized on the server before cosine/Euclidean computation.

3. **Liveness & Antispoofing:**
   - Eye blink verification (`blinkVerified: true`) is strictly required for camera check-in unless device biometrics are used.

4. **GPS Geofence:**
   - Student GPS coordinates are validated against classroom coordinates using the Haversine formula:
     $$\text{distance} = 2R \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1)\cos(\text{lat}_2)\sin^2\left(\frac{\Delta \text{lng}}{2}\right)}\right)$$

---

## 7. Error Handling & Status Codes

The API returns standard HTTP status codes with a JSON error payload:

```json
{
  "detail": "Descriptive error message explaining the issue."
}
```

| HTTP Status | Meaning | Typical Scenario |
| :--- | :--- | :--- |
| `200 OK` | Success | Request succeeded. |
| `400 Bad Request` | Validation Failure | Invalid Hall Ticket format, wrong descriptor length, or missing body fields. |
| `401 Unauthorized` | Auth Required | Missing or expired JWT Bearer token or invalid Edge API Key. |
| `403 Forbidden` | Access Denied | Role mismatch (e.g., student accessing admin route), face matching mismatch, or missing blink. |
| `404 Not Found` | Not Found | User or session does not exist. |
| `409 Conflict` | Conflict | Face biometrics are already enrolled; reset required before re-enrolling. |
| `500 Server Error` | Internal Failure | Database connectivity issue or unhandled exception. |

---

*SmartAttend AI API Documentation • Version 2.0.0*
