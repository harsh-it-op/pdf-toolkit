"""Authentication and authorization for PDFForge.
Handles password hashing with bcrypt and session management with JWTs.
"""
from __future__ import annotations

import os
import time
import uuid
import bcrypt
import jwt
from typing import Tuple

# --- config --------------------------------------------------------------------

# ponytail: store this in .env. In production, this must be a strong random secret.
SECRET_KEY = os.environ.get("PDFFORGE_SECRET_KEY", "dev-secret-change-me-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours


def hash_password(password: str) -> str:
    """Hash a plain-text password using bcrypt."""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain-text password against a bcrypt hash."""
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    """Generate a JWT access token for a specific user."""
    expire = time.time() + (ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    to_encode = {"exp": expire, "sub": user_id}
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> str | None:
    """Decode a JWT and return the user_id if valid."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id:
            return user_id
    except jwt.PyJWTError:
        # ponytail: invalid tokens are treated as None to let middleware
        # handle the 401 Unauthorized response.
        pass
    return None
