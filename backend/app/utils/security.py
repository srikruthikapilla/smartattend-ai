import bcrypt

def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str | None) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    if not hashed_password or not plain_password:
        return False
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def credential_version(password_hash: str) -> str:
    """Bind sessions to the stored password without disclosing its hash."""
    import hashlib
    import hmac
    from app.config import JWT_SECRET
    return hmac.new(JWT_SECRET.encode(), password_hash.encode(), hashlib.sha256).hexdigest()
