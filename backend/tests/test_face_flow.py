import asyncio
import uuid
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
from starlette.requests import Request
from pydantic import ValidationError
from app.utils.face_matcher import compare_face_embeddings, valid_face_vector
from app.utils.blink_detection import verify_blink_from_ear_history
from app.services.face_recognition_service import FaceRecognitionService
from app.models.schemas import VerifyCheckinPayload
from app.models.db_models import Student, AttendanceRecord, GeofenceConfig
from app.routes import checkin

VECTOR = [1.0] + [0.0] * 127
OTHER = [0.0, 1.0] + [0.0] * 126

@pytest.mark.parametrize("bad", [[0.0]*128, [float("nan")]*128, [float("inf")]*128, [1.0]*127, ["bad"]*128, [[1.0]]*128])
def test_invalid_vectors_fail_closed(bad):
    assert not valid_face_vector(bad)
    assert compare_face_embeddings(bad, VECTOR)[0] is False
    service = FaceRecognitionService()
    with pytest.raises(ValueError): service.register_embedding("STUDENT", bad)
    assert service.match_single_vector(bad)["matched"] is False

@pytest.mark.parametrize("dim", [128,512])
def test_same_and_different_faces(dim):
    first = [1.0]+[0.0]*(dim-1)
    other = [0.0,1.0]+[0.0]*(dim-2)
    assert compare_face_embeddings(first, first)[0]
    assert not compare_face_embeddings(first, other)[0]

@pytest.mark.parametrize("history", [[.1,.3], [.1,.2,.3], [.3,.2,.1], [.3]*8, [float("nan")]*3, [[.3],[.1],[.3]]])
def test_invalid_blink_rejected(history):
    assert not verify_blink_from_ear_history(history).is_valid_blink


def test_complete_blink_accepted():
    assert verify_blink_from_ear_history([.3,.29,.14,.25,.3]).is_valid_blink


@pytest.mark.parametrize("vector,history,biometric,enabled,expected", [
    (VECTOR,[.3,.29,.14,.25,.3],False,True,True),
    (OTHER,[.3,.29,.14,.25,.3],False,True,False),
    (VECTOR,[.3,.3,.3],False,True,False),
    (None,None,True,True,True),
    (VECTOR,[.3,.29,.14,.25,.3],False,False,True),
])
def test_attendance_verification_flow(monkeypatch, vector, history, biometric, enabled, expected):
    student = SimpleNamespace(status="approved", face_descriptor=VECTOR, face_enrollment_status="enrolled", name="Student", branch="CSE", section="A", biometric_credential_id="credential", biometric_public_key="key", biometric_sign_count=0)
    session = SimpleNamespace(id=uuid.uuid4(),session_title="Class",branch="CSE",section="A",geofence={"lat":17.0,"lng":80.0},radius_meters=150)
    db = MagicMock()
    def query(model):
        q = MagicMock()
        q.filter.return_value=q
        q.first.return_value={Student:student, AttendanceRecord:None, GeofenceConfig:SimpleNamespace(enabled=enabled)}.get(model)
        return q
    db.query.side_effect=query
    monkeypatch.setattr(checkin,"resolve_session",lambda *_:session)
    monkeypatch.setattr(checkin,"consume_otp",lambda *_:"1")
    monkeypatch.setattr(checkin,"invalidate_student_cache",lambda *_:None)
    monkeypatch.setattr(checkin,"enqueue_audit_log",lambda **_:None)
    monkeypatch.setattr(checkin,"sio_server",None)
    from app.services import webauthn_service
    monkeypatch.setattr(webauthn_service,"verify_authentication_response",lambda **_:(True,{"newSignCount":1}))
    payload=VerifyCheckinPayload(token="test",hallTicket="2345678901",lat=17,lng=80,faceDescriptor=vector,earHistory=history,challengeToken="fresh",webauthnAssertion={"credentialId":"credential"} if biometric else None)
    endpoint=checkin.verify_student_checkin.__wrapped__
    req=Request({"type":"http","headers":[]})
    if expected:
        result=asyncio.run(endpoint(req,payload,db))
        assert result["success"]
        saved=db.add.call_args.args[0]
        assert saved.verification_method == ("webauthn_platform" if biometric else "face_recognition")
        assert saved.biometric_verified is biometric
        db.commit.assert_called()
    else:
        with pytest.raises(HTTPException) as exc: asyncio.run(endpoint(req,payload,db))
        assert exc.value.status_code==403
        db.add.assert_not_called()


def test_revoked_database_enrollment_never_uses_stale_cache(monkeypatch):
    db=MagicMock()
    db.query.return_value.filter.return_value.first.return_value=SimpleNamespace(status="approved",face_enrollment_status="pending",face_descriptor=None)
    @contextmanager
    def context(): yield db
    monkeypatch.setattr(checkin,"get_db_context",context)
    monkeypatch.setattr(checkin,"student_face_cache",{"2345678901":{"descriptor":VECTOR}})
    assert checkin._load_enrolled_face_descriptor("2345678901") is None


def test_failed_enrollment_does_not_publish_to_matching_cache(monkeypatch):
    from app.routes import student_face
    from app.models.schemas import FaceEmbeddingPayload
    student=SimpleNamespace(id=uuid.uuid4(),hall_ticket_no="2345678901",name="Student",status="approved")
    db=MagicMock()
    db.commit.side_effect=RuntimeError("Database unavailable")
    monkeypatch.setattr(student_face,"_find_user",lambda *_:student)
    publish=MagicMock()
    monkeypatch.setattr(student_face,"_cache_face_descriptor",publish)
    with pytest.raises(HTTPException):
        student_face.update_student_face("2345678901",FaceEmbeddingPayload(faceDescriptor=VECTOR),{"role":"admin","id":"staff"},db)
    publish.assert_not_called()
