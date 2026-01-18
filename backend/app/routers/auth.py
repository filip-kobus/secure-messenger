from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.schemas.auth import LoginRequest, RegisterRequest, LogoutRequest
from app.models.user import User
from app.crud.users import get_user_by_email, create_user
from app.crud.tokens import add_refresh_token, check_refresh_token, revoke_refresh_token, revoke_all_user_tokens
from app.utils.password_hasher import verify_password, hash_password
from app.utils.rate_limiter import limiter
from app.config import RateLimitConfig
from app.db import AsyncSession, get_db
from app.utils.totp_manager import verify_totp_code, decrypt_totp_secret
from app.utils.tokens_manager import create_access_token, create_refresh_token, refresh_access_token
from app.dependencies import get_current_user, get_redis
import redis.asyncio as redis
from app.utils.tokens_manager import verify_token
import uuid

router = APIRouter()


@router.post("/auth/login", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_LOGIN)
async def login(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
    redis_conn: redis.Redis = Depends(get_redis)
):
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
        if not verify_totp_code(totp_secret, totp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid TOTP code"
            )
    if user.totp_secret_encrypted and not user.is_2fa_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="TOTP setup incomplete. Please enable 2FA."
        )
    
    refresh_token_id = str(uuid.uuid4())
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    from app.utils.tokens_manager import verify_token
    payload = verify_token(refresh_token, "refresh")
    refresh_token_id = payload.get("jti")
    
    access_token = create_access_token({"sub": str(user.id)}, refresh_token_id=refresh_token_id)
    
    await revoke_all_user_tokens(redis_conn, user.id)
    await add_refresh_token(redis_conn, user.id, refresh_token_id)
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "encrypted_private_key": user.encrypted_private_key
    }


@router.post("/auth/register", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_REGISTER)
async def register(request: Request, register_data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    try:
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
            public_key=register_data.public_key,
            encrypted_private_key=register_data.encrypted_private_key
        )

        await create_user(db, user)
        return {"message": "User registered successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Registration failed: {str(e)}"
        )


@router.post("/auth/refresh-token", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_REFRESH)
async def refresh_token_endpoint(
    request: Request,
    refresh_token: str,
    redis_conn: redis.Redis = Depends(get_redis)
):
    print(f"[DEBUG] Refresh token request: {refresh_token[:50]}...")
    
    from app.utils.tokens_manager import verify_token
    payload = verify_token(refresh_token, "refresh")
    if not payload:
        print("[DEBUG] Invalid refresh token JWT")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    refresh_token_id = payload.get("jti")
    if not refresh_token_id:
        print("[DEBUG] Refresh token missing jti claim")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token format"
        )
    
    user_id = await check_refresh_token(redis_conn, refresh_token_id)
    print(f"[DEBUG] Redis token found: {user_id is not None}")
    
    if not user_id:
        print("[DEBUG] Token not found in Redis or revoked")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token"
        )
    
    new_access_token = refresh_access_token(refresh_token, refresh_token_id)
    print(f"[DEBUG] New access token created: {new_access_token is not None}")
    
    if not new_access_token:
        print("[DEBUG] Failed to create new access token")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
        
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
    }

@router.post("/auth/logout", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_REFRESH)
async def logout(
    request: Request,
    body: LogoutRequest,
    redis_conn: redis.Redis = Depends(get_redis)
):
    refresh_token = body.refresh_token
    payload = verify_token(refresh_token, "refresh")
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id = payload.get("sub")
    refresh_token_id = payload.get("jti")
    
    if not user_id or not refresh_token_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )
    
    print(f"[DEBUG logout] User {user_id} logging out")
    await revoke_all_user_tokens(redis_conn, int(user_id))
    print(f"[DEBUG logout] Tokens revoked for user {user_id}")
    return {"message": "Logged out successfully"}


@router.get("/auth/me", tags=["auth"])
@limiter.limit(RateLimitConfig.DEFAULT_LIMIT)
async def get_me(request: Request, current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email
    }


@router.post("/auth/unlock-private-key", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_ATTEMPTS)
async def unlock_private_key(
    request: Request,
    password: str,
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint do ponownego pobrania encrypted_private_key.
    Wymaga poprawnego hasła i ważnego JWT tokena.
    Używany gdy użytkownik ma refresh_token ale stracił privateKey (np. po restarcie przeglądarki).
    """
    # Weryfikuj hasło
    if not verify_password(password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid password"
        )
    
    return {
        "encrypted_private_key": current_user.encrypted_private_key
    }
