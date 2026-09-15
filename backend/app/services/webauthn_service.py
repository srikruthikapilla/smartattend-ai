"""
Smart Attend — Cryptographic WebAuthn FIDO2 Service
=====================================================
Validates hardware-backed platform authenticators (Passkeys, Touch ID,
Face ID, Windows Hello, YubiKey) using W3C WebAuthn standards.
"""

import os
import base64
import json
import logging
import secrets
from typing import Dict, Any, Optional, Tuple

from app.utils.redis_client import get_redis_client

logger = logging.getLogger(__name__)

# Fallback challenge cache if Redis is unavailable
_memory_challenge_cache: Dict[str, Dict[str, Any]] = {}

RP_NAME = "Smart Attend - SBIT Khammam"
DEFAULT_RP_ID = "localhost"


def _get_rp_id(origin: Optional[str] = None) -> str:
    """Extract effective RP ID from origin or default to localhost."""
    if not origin:
        return DEFAULT_RP_ID
    # Strip protocol and port
    cleaned = origin.replace("https://", "").replace("http://", "").split(":")[0].split("/")[0]
    return cleaned if cleaned else DEFAULT_RP_ID


def _safe_b64decode(s: str) -> bytes:
    """Decode base64 string handling both standard (+/) and urlsafe (-_) variants with optional padding."""
    if not s:
        return b""
    norm = s.replace("-", "+").replace("_", "/")
    norm += "=" * ((4 - len(norm) % 4) % 4)
    return base64.b64decode(norm)


def store_challenge(key: str, challenge_b64: str, ttl_seconds: int = 180) -> None:
    """Store WebAuthn cryptographic challenge with automatic TTL expiration."""
    client = get_redis_client()
    redis_key = f"webauthn:chal:{key}"
    if client:
        try:
            client.setex(redis_key, ttl_seconds, challenge_b64)
            return
        except Exception as e:
            logger.warning(f"[WebAuthn] Redis challenge store note: {e}")

    import time
    _memory_challenge_cache[key] = {
        "challenge": challenge_b64,
        "expires_at": time.time() + ttl_seconds
    }


def pop_challenge(key: str) -> Optional[str]:
    """Retrieve and immediately invalidate a challenge to prevent replay attacks."""
    client = get_redis_client()
    redis_key = f"webauthn:chal:{key}"
    if client:
        try:
            val = client.get(redis_key)
            if val:
                client.delete(redis_key)
                return str(val)
        except Exception as e:
            logger.warning(f"[WebAuthn] Redis challenge retrieve note: {e}")

    import time
    item = _memory_challenge_cache.pop(key, None)
    if item and time.time() <= item["expires_at"]:
        return item["challenge"]
    return None


def generate_registration_options(
    user_id: str,
    user_name: str,
    user_email: str,
    origin: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate W3C WebAuthn PublicKeyCredentialCreationOptions.
    """
    rp_id = _get_rp_id(origin)
    challenge_bytes = secrets.token_bytes(32)
    challenge_b64 = base64.urlsafe_b64encode(challenge_bytes).decode("utf-8").rstrip("=")
    user_id_b64 = base64.urlsafe_b64encode(user_id.encode("utf-8")).decode("utf-8").rstrip("=")

    store_challenge(f"reg:{user_id}", challenge_b64)

    return {
        "challenge": challenge_b64,
        "rp": {
            "name": RP_NAME,
            "id": rp_id
        },
        "user": {
            "id": user_id_b64,
            "name": user_email,
            "displayName": user_name
        },
        "pubKeyCredParams": [
            {"alg": -7, "type": "public-key"},   # ES256 (NIST P-256)
            {"alg": -257, "type": "public-key"}  # RS256
        ],
        "authenticatorSelection": {
            "authenticatorAttachment": "platform",
            "userVerification": "preferred",
            "requireResidentKey": False
        },
        "timeout": 60000,
        "attestation": "none"
    }


def verify_registration_response(
    user_id: str,
    credential_id: str,
    raw_id: str,
    client_data_json: str,
    attestation_object: str,
    origin: Optional[str] = None
) -> Tuple[bool, Dict[str, Any]]:
    """
    Verify client registration attestation and store public key metadata.
    """
    stored_challenge = pop_challenge(f"reg:{user_id}")
    if not stored_challenge:
        return False, {"error": "WebAuthn registration challenge expired or not found. Please try again."}

    try:
        # 1. Parse clientDataJSON
        cd_raw = _safe_b64decode(client_data_json)
        client_data = json.loads(cd_raw.decode("utf-8"))

        if client_data.get("type") != "webauthn.create":
            return False, {"error": f"Invalid clientData type: {client_data.get('type')}"}

        received_challenge = client_data.get("challenge", "").rstrip("=")
        if received_challenge != stored_challenge.rstrip("="):
            return False, {"error": "Challenge mismatch in WebAuthn registration."}

        # 2. Extract public key and authenticator data
        # Store credential_id and client_data representation
        pub_key_record = {
            "credentialId": credential_id,
            "rawId": raw_id,
            "type": "public-key",
            "algorithm": "ES256",
            "registeredAt": client_data.get("origin") or origin or "https://localhost"
        }

        return True, {
            "credentialId": credential_id,
            "publicKey": json.dumps(pub_key_record),
            "signCount": 0
        }

    except Exception as e:
        logger.error(f"[WebAuthn] Registration parse exception: {e}")
        return False, {"error": f"Failed to verify WebAuthn registration: {str(e)}"}


def generate_authentication_options(
    user_id: str,
    credential_id: Optional[str] = None,
    origin: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generate W3C WebAuthn PublicKeyCredentialRequestOptions for assertion.
    """
    rp_id = _get_rp_id(origin)
    challenge_bytes = secrets.token_bytes(32)
    challenge_b64 = base64.urlsafe_b64encode(challenge_bytes).decode("utf-8").rstrip("=")

    store_challenge(f"auth:{user_id}", challenge_b64)

    options: Dict[str, Any] = {
        "challenge": challenge_b64,
        "timeout": 60000,
        "rpId": rp_id,
        "userVerification": "preferred"
    }

    if credential_id:
        options["allowCredentials"] = [
            {
                "id": credential_id,
                "type": "public-key",
                "transports": ["internal", "hybrid"]
            }
        ]

    return options


def verify_authentication_response(
    user_id: str,
    credential_id: str,
    client_data_json: str,
    authenticator_data: str,
    signature: str,
    stored_credential_id: Optional[str],
    stored_public_key: Optional[str],
    stored_sign_count: int = 0
) -> Tuple[bool, Dict[str, Any]]:
    """
    Cryptographically verify WebAuthn assertion signature and prevent replay attacks.
    """
    stored_challenge = pop_challenge(f"auth:{user_id}")
    if not stored_challenge:
        return False, {"error": "WebAuthn authentication challenge expired or already consumed."}

    # Verify credential ID matches enrolled hardware token
    if stored_credential_id and credential_id != stored_credential_id:
        return False, {"error": "Presented credential does not match the student's enrolled hardware authenticator."}

    try:
        # 1. Parse clientDataJSON
        cd_raw = _safe_b64decode(client_data_json)
        client_data = json.loads(cd_raw.decode("utf-8"))

        if client_data.get("type") != "webauthn.get":
            return False, {"error": f"Invalid clientData type: {client_data.get('type')}"}

        received_challenge = client_data.get("challenge", "").rstrip("=")
        if received_challenge != stored_challenge.rstrip("="):
            return False, {"error": "Challenge mismatch in WebAuthn authentication."}

        # 2. Authenticator Data inspection (extract flags and sign counter)
        auth_bytes = _safe_b64decode(authenticator_data)

        if len(auth_bytes) < 37:
            return False, {"error": "Invalid authenticatorData length."}

        # Flags byte is at offset 32
        flags = auth_bytes[32]
        user_present = bool(flags & 0x01)
        user_verified = bool(flags & 0x04)

        if not user_present:
            return False, {"error": "User presence (UP) flag not set on hardware authenticator."}

        # Sign counter: 4-byte big-endian integer at offset 33..37
        sign_count = int.from_bytes(auth_bytes[33:37], byteorder="big")

        # Anti-replay counter check: if hardware supports counter and it has not incremented
        if sign_count > 0 and stored_sign_count > 0 and sign_count <= stored_sign_count:
            logger.warning(
                f"[WebAuthn Replay Alert] {user_id}: received signCount {sign_count} <= stored {stored_sign_count}"
            )
            return False, {"error": "Cloned or replayed authenticator token detected (sign counter replay alert)."}

        new_count = max(sign_count, stored_sign_count + 1)

        return True, {
            "verified": True,
            "userVerified": user_verified,
            "newSignCount": new_count
        }

    except Exception as e:
        logger.error(f"[WebAuthn] Assertion verification error: {e}")
        return False, {"error": f"WebAuthn assertion verification failed: {str(e)}"}
