
from fastapi import HTTPException, Depends, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from jose import JWTError, jwt
import redis.asyncio as redis
from loguru import logger

from app.config import SECRET_KEY, JWTConfig, REDIS_HOST, REDIS_PORT, REDIS_DB, REDIS_PASSWORD
from app.db import get_db

redis_client = None

async def get_redis() -> redis.Redis:
    global redis_client
    if redis_client is None:
        redis_client = redis.Redis(
            host=REDIS_HOST,
            port=REDIS_PORT,
            db=REDIS_DB,
            password=REDIS_PASSWORD,
            decode_responses=True
        )
    return redis_client

async def close_redis():
    global redis_client
    if redis_client:
        await redis_client.close()
        redis_client = None

async def verify_access_token(
    request: Request,
    redis_conn: redis.Redis = Depends(get_redis)
) -> str:
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Brak tokenu dostępu"
        )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[JWTConfig.ALGORITHM])
        user_id: str = payload.get("sub")
        refresh_token_id: str = payload.get("refresh_token_id")
        
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nieprawidłowa zawartość tokenu"
            )
        
        if not refresh_token_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nieprawidłowy format tokenu"
            )
        
        token_exists = await redis_conn.exists(f"refresh_token:{refresh_token_id}")
        if not token_exists:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Sesja wygasła lub użytkownik się wylogował"
            )
        
        return user_id
    except JWTError as e:
        logger.error(f"JWT validation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy lub wygasły token dostępu"
        )

async def get_current_user(
    user_id: str = Depends(verify_access_token),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Pobiera aktualnego użytkownika z JWT."""
    result = await db.execute(
        select(User).where(User.id == int(user_id))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Użytkownik nie znaleziony"
        )
    return user
