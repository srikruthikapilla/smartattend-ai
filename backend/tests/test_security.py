import asyncio
import base64
import hashlib
import json
import time
import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock
import cbor2
import jwt
import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient
from starlette.requests import Request
from app.config import JWT_SECRET
from app.utils.security import credential_version
from app.database import get_db
from app.dependencies.auth import get_current_user, require_role
from app.main import fastapi_app, connect
from app.routes import auth, qr_session
from app.services import webauthn_service as webauthn


def database(account=None):
    db = MagicMock()
    db.get.return_value = None
    db.query.return_value.filter.return_value.first.return_value = account
    return db


def request():
    return Request({"type": "http", "headers": []})


def token(**updates):
    claims = {"sub": str(uuid.uuid4()), "role": "admin", "type": "access", "exp": time.time()+300, "jti":str(uuid.uuid4()), "credential_version":credential_version("")}
    claims.update(updates)
    return jwt.encode(claims, JWT_SECRET, algorithm="HS256")


@pytest.mark.parametrize("claims", [{"type": "qr"}, {"type": "enrollment"}, {"type": None}, {"exp": 1}, {"sub": ""}, {"role": "superadmin"}])
def test_session_token_rejections(claims):
    with pytest.raises(HTTPException) as exc:
        get_current_user(request(), None, "Bearer " + token(**claims), database())
    assert exc.value.status_code == 401


@pytest.mark.parametrize("account", [None, SimpleNamespace(status="pending"), SimpleNamespace(status="rejected")])
def test_deleted_or_disabled_account_rejected(account):
    with pytest.raises(HTTPException):
        get_current_user(request(), None, "Bearer " + token(), database(account))


def test_approved_account_uses_database_profile():
    account = SimpleNamespace(status="approved", email="real@example.com", name="Real")
    user = get_current_user(request(), None, "Bearer " + token(name="spoof"), database(account))
    assert user["name"] == "Real"


def dependencies(dep):
    yield dep.call
    for child in dep.dependencies:
        yield from dependencies(child)


def all_routes(routes):
    for route in routes:
        if isinstance(route, APIRoute):
            yield route
        elif hasattr(route, "original_router"):
            yield from all_routes(route.original_router.routes)


ROUTES = list(all_routes(fastapi_app.routes))
PROTECTED = [route for route in ROUTES if isinstance(route, APIRoute)
             and get_current_user in set(dependencies(route.dependant))]


@pytest.mark.parametrize("route", PROTECTED, ids=lambda r: next(iter(r.methods))+" "+r.path)
def test_every_protected_route_rejects_anonymous(route):
    import re
    path = re.sub(r"{[^}]+}", str(uuid.uuid4()), route.path)
    fastapi_app.dependency_overrides[get_db] = lambda: database()
    auth._limiter.enabled = False
    try:
        response = TestClient(fastapi_app).request(next(iter(route.methods)), path, json={})
        assert response.status_code == 401, response.text
    finally:
        fastapi_app.dependency_overrides.clear()


@pytest.mark.parametrize("value", ["random", str(uuid.uuid4()), token(), jwt.encode({"type":"qr", "sessionId":str(uuid.uuid4()), "exp":1, "iat":0}, JWT_SECRET, algorithm="HS256")])
def test_qr_rejects_invalid_capabilities(value):
    db = database()
    with pytest.raises(HTTPException):
        qr_session.resolve_session(value, db)
    db.query.assert_not_called()


def test_qr_requires_live_database_session():
    value = qr_session.generate_signed_token(str(uuid.uuid4()), "faculty", "CSE", "A")
    with pytest.raises(HTTPException):
        qr_session.resolve_session(value, database())
    live = SimpleNamespace(id=uuid.uuid4())
    assert qr_session.resolve_session(value, database(live)) is live


def test_faculty_cannot_end_another_session():
    with pytest.raises(HTTPException) as exc:
        qr_session.end_session(uuid.uuid4(), {"id":"other", "role":"faculty"}, database(SimpleNamespace(faculty_id="owner")))
    assert exc.value.status_code == 403


def test_websocket_rejects_anonymous():
    assert asyncio.run(connect("test", {"asgi.scope":{"type":"http", "headers":[]}})) is False


def test_cross_origin_mutation_rejected():
    response = TestClient(fastapi_app).post("/api/auth/logout", headers={"origin":"https://evil.example"})
    assert response.status_code == 403


def b64(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


@pytest.mark.parametrize("tamper", [False, True])
def test_passkey_signature_is_cryptographically_checked(monkeypatch, tamper):
    monkeypatch.setattr(webauthn, "get_redis_client", lambda: None)
    private = ec.generate_private_key(ec.SECP256R1())
    public = private.public_key().public_numbers()
    key = cbor2.dumps({1:2, 3:-7, -1:1, -2:public.x.to_bytes(32,"big"), -3:public.y.to_bytes(32,"big")})
    challenge = b64(b"fresh-random-challenge")
    webauthn.store_challenge("auth:student", challenge)
    client = json.dumps({"type":"webauthn.get", "challenge":challenge, "origin":"http://localhost:3000"}).encode()
    authenticator = hashlib.sha256(b"localhost").digest() + bytes([5]) + (1).to_bytes(4,"big")
    signature = private.sign(authenticator + hashlib.sha256(client).digest(), ec.ECDSA(hashes.SHA256()))
    if tamper:
        signature = signature[:-1] + bytes([signature[-1] ^ 1])
    valid, result = webauthn.verify_authentication_response("student", b64(b"credential"), b64(client), b64(authenticator), b64(signature), b64(b"credential"), b64(key), 0)
    assert valid is not tamper, result
    replay, _ = webauthn.verify_authentication_response("student", b64(b"credential"), b64(client), b64(authenticator), b64(signature), b64(b"credential"), b64(key), 0)
    assert replay is False


def test_public_registration_cannot_self_approve():
    db = database()
    auth.register_user(auth.RegisterUserRequest(email="s@example.com", name="Student", hall_ticket_no="2345678901", status="approved"), None, db)
    assert db.add.call_args.args[0].status == "pending"


def test_student_cannot_modify_other_student():
    db = MagicMock()
    db.query.return_value.filter.return_value.first.side_effect = [None, None, SimpleNamespace(id=uuid.uuid4())]
    with pytest.raises(HTTPException) as exc:
        auth.update_user(str(uuid.uuid4()), auth.UpdateUserRequest(name="Changed"), {"id":str(uuid.uuid4()), "role":"student"}, db)
    assert exc.value.status_code == 403
    db.commit.assert_not_called()


@pytest.mark.parametrize("claims", [{"type":"attendance_report", "ht":"OTHER"}, {"type":"enrollment", "ht":"2345678901"}, {"type":"attendance_report", "ht":"2345678901", "exp":1}])
def test_report_token_is_scoped(claims):
    from app.dependencies.auth import require_student_report
    claims.setdefault("exp", time.time()+300)
    signed = jwt.encode(claims, JWT_SECRET, algorithm="HS256")
    req = Request({"type":"http", "headers":[(b"x-student-report-token", signed.encode())]})
    with pytest.raises(HTTPException):
        require_student_report("2345678901", req, None)


def test_valid_report_token():
    from app.dependencies.auth import require_student_report
    signed = jwt.encode({"type":"attendance_report", "ht":"2345678901", "exp":time.time()+300}, JWT_SECRET, algorithm="HS256")
    req = Request({"type":"http", "headers":[(b"x-student-report-token", signed.encode())]})
    assert require_student_report("2345678901", req, None)["ht"] == "2345678901"


def test_passkey_registration_requires_identity_proof():
    from app.routes.webauthn import authorize_registration, RegisterOptionsRequest
    account = SimpleNamespace(status="approved", biometric_public_key=None)
    with pytest.raises(HTTPException) as exc:
        authorize_registration(RegisterOptionsRequest(hallTicketNo="2345678901"), None, database(account))
    assert exc.value.status_code == 403


def test_route_inventory_has_no_unclassified_routes():
    from app.dependencies.auth import get_optional_current_user, verify_edge_key, require_student_report
    public = {
        "/health", "/api/health", "/api/admin/geofence",
        "/api/auth/logout", "/api/auth/login", "/api/auth/request-reset", "/api/auth/reset-password",
        "/api/auth/student/enrollment/request-otp", "/api/auth/student/enrollment/verify-otp",
        "/api/checkin/session/{token:path}", "/api/student/check-status/{hall_ticket}",
        "/api/checkin/challenge", "/api/checkin/verify",
        "/api/biometrics/webauthn/auth-options", "/api/biometrics/webauthn/auth-verify"}
    assert len(ROUTES) >= 50
    for route in ROUTES:
        if isinstance(route, APIRoute):
            guards = set(dependencies(route.dependant))
            assert route.path in public or guards.intersection({get_current_user, get_optional_current_user, verify_edge_key, require_student_report}), route.path


@pytest.mark.parametrize("route", [r for r in PROTECTED if any(getattr(d, "__name__", "") == "role_checker" for d in dependencies(r.dependant))], ids=lambda r: next(iter(r.methods))+" "+r.path)
def test_staff_routes_reject_student_role(route):
    for checker in dependencies(route.dependant):
        if getattr(checker, "__name__", "") == "role_checker":
            with pytest.raises(HTTPException) as exc:
                checker({"role":"student"})
            assert exc.value.status_code == 403


def test_revoked_session_rejected():
    db = database(SimpleNamespace(status="approved", email="e", name="n"))
    db.get.return_value = SimpleNamespace(action="SESSION_REVOKED")
    with pytest.raises(HTTPException) as exc:
        get_current_user(request(), None, "Bearer " + token(), db)
    assert exc.value.status_code == 401


def test_password_change_revokes_previous_session():
    db = database(SimpleNamespace(status="approved", email="e", name="n", password_hash="new-hash"))
    with pytest.raises(HTTPException) as exc:
        get_current_user(request(), None, "Bearer " + token(), db)
    assert exc.value.status_code == 401


def test_logout_persists_revocation():
    from fastapi import Response
    db = database()
    session_id = str(uuid.uuid4())
    auth.logout(Response(), {"id":"staff", "role":"admin", "payload":{"jti":session_id, "exp":time.time()+300}}, db)
    assert str(db.add.call_args.args[0].id) == session_id
    assert db.add.call_args.args[0].action == "SESSION_REVOKED"
    db.commit.assert_called_once()
