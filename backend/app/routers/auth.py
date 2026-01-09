from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.schemas.auth import LoginRequest, RegisterRequest
from backend.app.models.user import User
from app.crud.users import get_user_by_email, create_user
from app.crud.tokens import add_refresh_token, check_refresh_token, revoke_refresh_token
from app.utils.password_hasher import verify_password, hash_password
from app.utils.rate_limiter import limiter
from app.config import RateLimitConfig
from app.db import AsyncSession, get_db
from app.utils.totp_manager import verify_totp_code, decrypt_totp_secret
from app.utils.tokens_manager import create_access_token, create_refresh_token, refresh_access_token

router = APIRouter()


@router.post("/login/", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_LOGIN)
async def login(request: Request, login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, login_data.email)
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    totp_code = login_data.totp_code
    if user.is_2fa_enabled and not totp_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA enabled. Please verify TOTP code."
        )
    if user.is_2fa_enabled:
        totp_secret = decrypt_totp_secret(user.totp_secret_encrypted)
        if not verify_totp_code(totp_secret, str(totp_code)):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid TOTP code"
            )
    if user.totp_secret_encrypted and not user.is_2fa_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="TOTP setup incomplete. Please enable 2FA."
        )
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    await add_refresh_token(db, user.id, refresh_token)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/register/", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_REGISTER)
async def register(request: Request, register_data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    existing_user = await get_user_by_email(db, register_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )
    
    hashed_password = hash_password(register_data.password)
    user = User(
        username=register_data.username,
        email=register_data.email,
        password_hash=hashed_password,
    )

    await create_user(db, user)
    return {"message": "User registered successfully"}


@router.post("/refresh-token/", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_REFRESH)
async def refresh_token_endpoint(request: Request, refresh_token: str, db: AsyncSession = Depends(get_db)):
    db_token = await check_refresh_token(db, refresh_token)
    if not db_token or db_token.revoked:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token"
        )
    
    new_access_token = refresh_access_token(refresh_token)
    
    if not new_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
        
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
    }

@router.post("/logout/", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_REFRESH)
async def logout(request: Request, refresh_token: str, db: AsyncSession = Depends(get_db)):
    db_token = await check_refresh_token(db, refresh_token)
    if db_token:
        await revoke_refresh_token(db, refresh_token)
    return {"message": "Logged out successfully"}
