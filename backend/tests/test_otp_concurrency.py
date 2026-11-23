import asyncio
import concurrent.futures
import json
import time
import uuid
from typing import Dict, Any
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.database import get_db
from app.main import fastapi_app
from app.models.db_models import Student, Admin, Faculty
from app.utils.redis_client import (
    set_otp,
    get_otp,
    delete_otp,
    is_redis_available,
    get_redis_client,
    mark_redis_failure,
    test_redis_connection as check_redis_conn,
    _memory_otp_cache,
    _memory_lock,
)


# ============================================================================
# Helpers & Fixtures
# ============================================================================

def make_mock_student(ht: str, email: str, name: str = "Test Student"):
    student = MagicMock(spec=Student)
    student.hall_ticket_no = ht
    student.email = email
    student.name = name
    student.face_enrollment_status = "pending"
    return student


def make_mock_admin(email: str, name: str = "Test Admin"):
    admin = MagicMock(spec=Admin)
    admin.email = email
    admin.name = name
    admin.password_hash = "$2b$12$e..."
    return admin


# ============================================================================
# Test Suite 1: Direct Redis Client & In-Memory Fallback Concurrency
# ============================================================================

def test_redis_connection_status_helper():
    stats = check_redis_conn()
    assert "status" in stats
    assert "cooldown_active" in stats


def test_redis_failure_cooldown_and_fast_fallback():
    """
    Verify that when Redis is down, mark_redis_failure initiates cooldown
    and subsequent calls to get_redis_client() return None in ~0ms rather than
    blocking for socket connect timeouts.
    """
    mark_redis_failure(ConnectionRefusedError("Simulated Redis Down"))
    
    t0 = time.perf_counter()
    for _ in range(100):
        client = get_redis_client()
        assert client is None
    elapsed = time.perf_counter() - t0
    
    # 100 calls should take less than 50ms in cooldown
    assert elapsed < 0.05, f"Expected <50ms for 100 fast-fail calls, took {elapsed:.4f}s"
    assert is_redis_available() is False


def test_concurrent_otp_generation_when_redis_down():
    """
    Simulate 50 threads generating and verifying OTPs concurrently with Redis down.
    Ensures thread-safe in-memory cache and zero blocking.
    """
    mark_redis_failure(ConnectionRefusedError("Simulated Redis Down"))
    
    with _memory_lock:
        _memory_otp_cache.clear()

    num_threads = 50
    results = {}

    def worker(i: int):
        email = f"student_{i}@sbit.ac.in"
        otp = f"{100000 + i}"
        t_start = time.perf_counter()
        
        # Set OTP
        set_ok = set_otp(email, otp, ttl_seconds=300)
        # Retrieve OTP
        retrieved = get_otp(email)
        # Verify retrieved matches
        match = (retrieved == otp)
        
        t_duration = time.perf_counter() - t_start
        return i, set_ok, match, t_duration

    t_total_start = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
        futures = [executor.submit(worker, i) for i in range(num_threads)]
        for f in concurrent.futures.as_completed(futures):
            i, set_ok, match, dur = f.result()
            results[i] = (set_ok, match, dur)
    t_total = time.perf_counter() - t_total_start

    assert len(results) == num_threads
    for i in range(num_threads):
        set_ok, match, dur = results[i]
        assert set_ok is True
        assert match is True
        assert dur < 0.1, f"Thread {i} took too long: {dur:.4f}s"

    # Total time for 50 concurrent threads should be sub-second
    assert t_total < 1.0, f"50 concurrent OTP ops took {t_total:.4f}s (expected <1s)"


def test_concurrent_otp_generation_when_redis_available():
    """
    Simulate 50 concurrent threads operating against an active thread-safe Redis client.
    """
    mock_redis_storage = {}
    mock_redis_lock = concurrent.futures.thread.threading.Lock()

    mock_client = MagicMock()
    
    def mock_setex(key, ttl, val):
        with mock_redis_lock:
            mock_redis_storage[key] = str(val)
        return True

    def mock_get(key):
        with mock_redis_lock:
            return mock_redis_storage.get(key)

    mock_client.setex.side_effect = mock_setex
    mock_client.get.side_effect = mock_get
    mock_client.ping.return_value = True

    with patch("app.utils.redis_client.get_redis_client", return_value=mock_client):
        num_threads = 50
        def worker(i: int):
            email = f"redis_user_{i}@sbit.ac.in"
            otp = f"{200000 + i}"
            set_otp(email, otp, ttl_seconds=300)
            retrieved = get_otp(email)
            return retrieved == otp

        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker, i) for i in range(num_threads)]
            for f in concurrent.futures.as_completed(futures):
                assert f.result() is True

    assert len(mock_redis_storage) == num_threads


# ============================================================================
# Test Suite 2: Multi-Device Campus Wi-Fi NAT Concurrency (Same IP, Diff Users)
# ============================================================================

def test_multi_device_same_ip_enrollment_otp_concurrency():
    """
    Simulate campus Wi-Fi scenario: 25 distinct student devices share the same public IP.
    All 25 students request enrollment OTP concurrently.
    - None should receive 429 Too Many Requests because limits are keyed by hall ticket.
    - All should receive 200 OK.
    """
    mock_db = MagicMock()
    
    # Configure mock DB to return a valid student for each hall ticket
    def query_filter_mock(*args, **kwargs):
        filter_mock = MagicMock()
        def first_mock():
            return make_mock_student(
                ht="21B81A0501",
                email="student@sbit.ac.in",
                name="SBIT Student"
            )
        filter_mock.first.side_effect = first_mock
        return filter_mock

    # Set up student lookup
    students_db = {}
    for i in range(25):
        ht = f"21B81A05{i:02d}"
        students_db[ht] = make_mock_student(ht=ht, email=f"student_{i}@sbit.ac.in", name=f"Student {i}")

    def dynamic_query(model):
        q = MagicMock()
        def dynamic_filter(clause):
            f = MagicMock()
            def dynamic_first():
                # Extract hall ticket from query string or return generic student
                for ht, s in students_db.items():
                    if ht in str(clause):
                        return s
                return list(students_db.values())[0]
            f.first = dynamic_first
            return f
        q.filter = dynamic_filter
        return q

    mock_db.query = dynamic_query
    fastapi_app.dependency_overrides[get_db] = lambda: mock_db

    shared_wifi_ip = "192.168.1.100"
    client = TestClient(fastapi_app)

    with patch("app.routes.auth.send_otp_email") as mock_email:
        mock_email.return_value = True

        def student_request(i: int):
            ht = f"21B81A05{i:02d}"
            response = client.post(
                "/api/auth/student/enrollment/request-otp",
                json={"hall_ticket_no": ht},
                headers={"X-Forwarded-For": shared_wifi_ip}
            )
            return ht, response.status_code, response.json()

        # Execute 25 concurrent requests from the same IP
        with concurrent.futures.ThreadPoolExecutor(max_workers=25) as executor:
            futures = [executor.submit(student_request, i) for i in range(25)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        # Verify all 25 students succeeded from the same IP without 429 collisions
        for ht, status_code, body in results:
            assert status_code == 200, f"Expected 200 for {ht} from {shared_wifi_ip}, got {status_code}: {body}"
            assert body.get("success") is True


def test_single_user_rate_limit_enforced_on_shared_ip():
    """
    On the same shared campus Wi-Fi IP, verify that:
    - If a single student spams requests > rate limit (5/min), that student gets 429.
    - Another student from the SAME IP can still successfully request OTP (200).
    """
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = make_mock_student(
        ht="21B81A0599", email="spam_student@sbit.ac.in"
    )
    fastapi_app.dependency_overrides[get_db] = lambda: mock_db

    shared_wifi_ip = "192.168.1.100"
    client = TestClient(fastapi_app)

    with patch("app.routes.auth.send_otp_email") as mock_email:
        mock_email.return_value = True

        # Rapidly send 7 requests for spammer student (limit is 5/minute)
        statuses = []
        for _ in range(7):
            res = client.post(
                "/api/auth/student/enrollment/request-otp",
                json={"hall_ticket_no": "21B81A0599"},
                headers={"X-Forwarded-For": shared_wifi_ip}
            )
            statuses.append(res.status_code)

        # First 5 should succeed (200), subsequent should be throttled (429)
        assert 429 in statuses, f"Expected 429 rate limit for spammer, got: {statuses}"

        # Now test that a DIFFERENT student on the EXACT SAME IP is NOT blocked
        mock_db.query.return_value.filter.return_value.first.return_value = make_mock_student(
            ht="21B81A0588", email="good_student@sbit.ac.in"
        )
        res_other = client.post(
            "/api/auth/student/enrollment/request-otp",
            json={"hall_ticket_no": "21B81A0588"},
            headers={"X-Forwarded-For": shared_wifi_ip}
        )
        assert res_other.status_code == 200, f"Unrelated student on same Wi-Fi got blocked with status {res_other.status_code}"


def test_password_reset_otp_same_ip_concurrency():
    """
    Simulate multiple faculty/admins requesting password reset from campus Wi-Fi (same IP).
    Each distinct email should get an independent rate limit window.
    """
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = make_mock_admin(
        email="faculty@sbit.ac.in", name="Faculty Member"
    )
    fastapi_app.dependency_overrides[get_db] = lambda: mock_db

    shared_wifi_ip = "192.168.1.100"
    client = TestClient(fastapi_app)

    with patch("app.routes.auth.send_otp_email") as mock_email:
        mock_email.return_value = True

        def reset_request(i: int):
            email = f"faculty_{i}@sbit.ac.in"
            response = client.post(
                "/api/auth/request-reset",
                json={"email": email},
                headers={"X-Forwarded-For": shared_wifi_ip}
            )
            return email, response.status_code

        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(reset_request, i) for i in range(10)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        for email, status_code in results:
            assert status_code == 200, f"Expected 200 for {email} from shared IP, got {status_code}"


# ============================================================================
# Test Suite 3: End-to-End OTP Generation & Verification during Redis Outage
# ============================================================================

def test_e2e_student_enrollment_otp_flow_during_redis_down():
    """
    Full end-to-end test of request-otp -> verify-otp during Redis outage:
    1. Mark Redis as failed (cooldown active).
    2. Student requests OTP -> stored in fallback memory cache.
    3. Student verifies OTP with correct code -> issued enrollment token.
    4. Second verification fails (OTP consumed).
    """
    mark_redis_failure(ConnectionRefusedError("Redis down"))

    student_ht = "21B81A0577"
    student_email = "student77@sbit.ac.in"
    mock_student = make_mock_student(ht=student_ht, email=student_email)

    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.first.return_value = mock_student
    fastapi_app.dependency_overrides[get_db] = lambda: mock_db

    client = TestClient(fastapi_app)

    dispatched_otps = []
    def capture_otp(to_email, name, otp_code):
        dispatched_otps.append(otp_code)
        return True

    with patch("app.routes.auth.send_otp_email", side_effect=capture_otp):
        # 1. Request OTP
        req_res = client.post(
            "/api/auth/student/enrollment/request-otp",
            json={"hall_ticket_no": student_ht}
        )
        assert req_res.status_code == 200
        assert len(dispatched_otps) == 1
        generated_otp = dispatched_otps[0]

        # 2. Verify with wrong OTP -> 400
        bad_verify = client.post(
            "/api/auth/student/enrollment/verify-otp",
            json={"hall_ticket_no": student_ht, "otp": "000000"}
        )
        assert bad_verify.status_code == 400

        # 3. Verify with correct OTP -> 200 & enrollment_token
        good_verify = client.post(
            "/api/auth/student/enrollment/verify-otp",
            json={"hall_ticket_no": student_ht, "otp": generated_otp}
        )
        assert good_verify.status_code == 200
        data = good_verify.json()
        assert "enrollment_token" in data
        assert data.get("success") is True

        # 4. Re-verify with same OTP -> 400 (already consumed)
        re_verify = client.post(
            "/api/auth/student/enrollment/verify-otp",
            json={"hall_ticket_no": student_ht, "otp": generated_otp}
        )
        assert re_verify.status_code == 400
