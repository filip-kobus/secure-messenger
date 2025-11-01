from app.config import JWTConfig, SECRET_KEY
from datetime import datetime, timedelta, timezone
from jose import jwt


def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=JWTConfig.ACCESS_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=JWTConfig.ALGORITHM)


def create_refresh_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(days=JWTConfig.REFRESH_EXPIRE_DAYS)
    )
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=JWTConfig.ALGORITHM)


def verify_token(token: str, token_type: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWTConfig.ALGORITHM])
        if payload.get("type") != token_type:
            return None
        return payload
    except jwt.JWTError:
        return None


def is_token_expired(token: str) -> bool:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWTConfig.ALGORITHM])
        exp = payload.get("exp")
        if exp is None:
            return True
        expire_time = datetime.fromtimestamp(exp, timezone.utc)
        return datetime.now(timezone.utc) > expire_time
    except jwt.JWTError:
        return True


def refresh_access_token(refresh_token: str) -> str | None:
    payload = verify_token(refresh_token, "refresh")
    if not payload or is_token_expired(refresh_token):
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    return create_access_token({"sub": user_id})
