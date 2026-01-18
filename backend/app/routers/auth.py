from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from app.schemas.auth import LoginRequest, RegisterRequest, PasswordResetRequest, PasswordResetConfirm
from app.models.user import User
from app.crud.users import get_user_by_email, create_user
from app.crud.tokens import add_refresh_token, check_refresh_token, revoke_refresh_token, revoke_all_user_tokens
from app.utils.password_hasher import verify_password, hash_password
from app.crud.messages import get_inbox_messages, get_sent_messages
from app.utils.rate_limiter import limiter
from app.config import RateLimitConfig, SECRET_KEY, JWTConfig
from app.db import AsyncSession, get_db
from app.utils.totp_manager import verify_totp_code, decrypt_totp_secret
from app.utils.tokens_manager import create_access_token, create_refresh_token, refresh_access_token
from app.dependencies import get_current_user, get_redis
import redis.asyncio as redis
from app.utils.tokens_manager import verify_token
import uuid
from loguru import logger
from jose import jwt
from datetime import datetime, timedelta

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
    
    payload = verify_token(refresh_token, "refresh")
    refresh_token_id = payload.get("jti")
    
    access_token = create_access_token({"sub": str(user.id)}, refresh_token_id=refresh_token_id)
    
    await revoke_all_user_tokens(redis_conn, user.id)
    await add_refresh_token(redis_conn, user.id, refresh_token_id)
    
    response = Response(content='{"encrypted_private_key": "' + user.encrypted_private_key + '"}', media_type="application/json")
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=3600
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=604800
    )
    return response


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
    redis_conn: redis.Redis = Depends(get_redis)
):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing"
        )
    
    from app.utils.tokens_manager import verify_token
    payload = verify_token(refresh_token, "refresh")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    refresh_token_id = payload.get("jti")
    if not refresh_token_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token format"
        )
    
    user_id = await check_refresh_token(redis_conn, refresh_token_id)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token"
        )
    
    new_access_token = refresh_access_token(refresh_token, refresh_token_id)
    
    if not new_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )
    
    response = Response(content='{"message": "Token refreshed"}', media_type="application/json")
    response.set_cookie(
        key="access_token",
        value=new_access_token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=3600
    )
    return response

@router.post("/auth/logout", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_REFRESH)
async def logout(
    request: Request,
    redis_conn: redis.Redis = Depends(get_redis)
):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing"
        )
    
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
    
    await revoke_all_user_tokens(redis_conn, int(user_id))
    
    response = Response(content='{"message": "Logged out successfully"}', media_type="application/json")
    response.delete_cookie(key="access_token", samesite="lax")
    response.delete_cookie(key="refresh_token", samesite="lax")
    return response


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
    current_user: User = Depends(get_current_user)
):
    body = await request.json()
    password = body.get("password")
    
    if not password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is required"
        )
    
    if not verify_password(password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid password"
        )
    
    return {
        "encrypted_private_key": current_user.encrypted_private_key
    }


@router.post("/auth/request-password-reset", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_ATTEMPTS)
async def request_password_reset(
    request: Request,
    reset_request: PasswordResetRequest,
    db: AsyncSession = Depends(get_db)
):
    user = await get_user_by_email(db, reset_request.email)
    
    if not user:
        return {
            "message": "Jeśli konto istnieje, wysłaliśmy link do resetowania hasła na podany adres email.",
        }
    
    reset_token_data = {
        "sub": str(user.id),
        "email": user.email,
        "exp": datetime.utcnow() + timedelta(hours=1)
    }
    reset_token = jwt.encode(reset_token_data, SECRET_KEY, algorithm=JWTConfig.ALGORITHM)
    
    # In a real application, you would send the reset link via email.
    reset_response = f"Jeśli konto istnieje, wysłaliśmy link do resetowania hasła na podany adres email. (http://localhost:4200/reset-password?token={reset_token} na {user.email})"
    
    return {
        "message": reset_response,
    }


@router.post("/auth/reset-password", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_ATTEMPTS)
async def reset_password(
    request: Request,
    reset_data: PasswordResetConfirm,
    db: AsyncSession = Depends(get_db),
    redis_conn: redis.Redis = Depends(get_redis)
):
    try:
        payload = jwt.decode(reset_data.token, SECRET_KEY, algorithms=[JWTConfig.ALGORITHM])
        user_id = payload.get("sub")
        email = payload.get("email")
        
        if not user_id or not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )
        
        user = await get_user_by_email(db, email)
        sent_messages = await get_sent_messages(db, user.id) or []
        inbox_messages = await get_inbox_messages(db, user.id) or []

        for msg, _ in sent_messages:
            msg.is_decryptable_sender = False
        for msg, _ in inbox_messages:
            msg.is_decryptable_receiver = False

        if not user or str(user.id) != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid reset token"
            )
        
        user.password_hash = hash_password(reset_data.new_password)
        user.public_key = reset_data.public_key
        user.encrypted_private_key = reset_data.encrypted_private_key

        await revoke_all_user_tokens(redis_conn, int(user_id))

        await db.commit()
        
        logger.info(f"Password reset successful for user {user.email}")
        
        return {"message": "Password reset successful"}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid reset token"
        )
