
from fastapi import HTTPException, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import SECRET_KEY, JWTConfig
from app.db import get_db

security = HTTPBearer()

def verify_access_token(token: HTTPAuthorizationCredentials = Depends(security)) -> str:
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[JWTConfig.ALGORITHM])
        print(f"Decoded JWT payload: {payload}")
        user_id: str = payload.get("sub")
        if user_id is None:
            print("Invalid token payload: 'sub' claim is missing")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        return user_id
    except JWTError as e:
        print(f"JWT Validation Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token"
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
            detail="User not found"
        )
    return user
