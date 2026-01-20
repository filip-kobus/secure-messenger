from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from app.schemas.auth import LoginRequest, RegisterRequest, PasswordResetRequest, PasswordResetConfirm
from app.models.user import User
from app.models.audit import HoneypotEvent
from app.crud.users import get_user_by_email, create_user
from app.crud.tokens import add_refresh_token, check_refresh_token, revoke_all_user_tokens, revoke_refresh_token
from app.utils.password_hasher import verify_password, hash_password
from app.crud.messages import get_inbox_messages, get_sent_messages
from app.utils.rate_limiter import limiter
from app.config import RateLimitConfig, SECRET_KEY, JWTConfig
from app.db import AsyncSession, get_db
from app.utils.totp_manager import verify_totp_code, decrypt_totp_secret
from app.utils.tokens_manager import create_access_token, create_refresh_token, refresh_access_token
from app.dependencies import get_current_user, get_redis
from app.crud.audit import log_login_event
import redis.asyncio as redis
from app.utils.tokens_manager import verify_token
import uuid
from loguru import logger
import json
from jose import jwt
from datetime import datetime, timedelta, timezone

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
    if not user:
        fake_hash = hash_password("fake_password")
        verify_password(login_data.password, fake_hash)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy email lub hasło"
        )
    if not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy email lub hasło"
        )
    
    totp_code = login_data.totp_code
    if user.is_2fa_enabled and not totp_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="2FA jest włączone. Proszę podać kod TOTP."
        )
    if user.is_2fa_enabled:
        totp_secret = decrypt_totp_secret(user.totp_secret_encrypted)
        if not verify_totp_code(totp_secret, totp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Nieprawidłowy kod TOTP"
            )
    
    # Generowanie tokenów
    refresh_token_id = str(uuid.uuid4())
    refresh_token = create_refresh_token({"sub": str(user.id)})
    
    payload = verify_token(refresh_token, "refresh")
    refresh_token_id = payload.get("jti")
    
    access_token = create_access_token(str(user.id), refresh_token_id)
    
    await add_refresh_token(redis_conn, user.id, refresh_token_id)
    
    response_data = {"encrypted_private_key": user.encrypted_private_key}
    
    # Monitorowanie logowania
    user_agent = request.headers.get("user-agent", "unknown")
    ip_address = request.headers.get("X-Forwarded-For") or request.client.host
    
    login_event = await log_login_event(
        db,
        user_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
    )

    if login_event.is_new_device and not login_event.is_new_ip:
        response_data["is_new_device"] = True
        message = (
            f"Wysłał bym email z powiadomieniem o nowym urządzeniu "
            f"na {user.email} o treści: Nowe logowanie z urządzenia "
            f"{user_agent} z adresu IP {ip_address}. "
            f"Jeśli to nie Ty, zalecamy zmianę hasła."
        )
        response_data["message"] = message


    response = Response(content=json.dumps(response_data), media_type="application/json")
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
    if register_data.honeypot:
        honeypot_event = HoneypotEvent(
            ip_address=request.client.host,
            user_agent=request.headers.get("user-agent"),
            endpoint="/auth/register"
        )
        db.add(honeypot_event)
        await db.commit()
        # Zwracam standardową odpowiedź, aby nie zdradzać istnienia honeypota
        return {"message": "Użytkownik zarejestrowany pomyślnie"}

    try:
        existing_user = await get_user_by_email(db, register_data.email)
        if existing_user:
            # Zwracam ogólną odpowiedź, aby nie zdradzać istnienia konta
            return {"message": "Użytkownik zarejestrowany pomyślnie"}
        
        hashed_password = hash_password(register_data.password)
        user = User(
            username=register_data.username,
            email=register_data.email,
            password_hash=hashed_password,
            public_key=register_data.public_key,
            encrypted_private_key=register_data.encrypted_private_key
        )

        await create_user(db, user)
        return {"message": "Użytkownik zarejestrowany pomyślnie"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Rejestracja się nie powiodła: {str(e)}"
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
            detail="Brak tokenu odświeżania"
        )
    
    payload = verify_token(refresh_token, "refresh")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy token odświeżania"
        )
    
    refresh_token_id = payload.get("jti")
    if not refresh_token_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy format tokenu odświeżania"
        )
    
    user_id = await check_refresh_token(redis_conn, refresh_token_id)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy lub unieważniony token odświeżania"
        )
    
    new_access_token = refresh_access_token(refresh_token, refresh_token_id)
    
    if not new_access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy lub wygasły token odświeżania"
        )
    
    response = Response(content='{"message": "Token odświeżony"}', media_type="application/json")
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
    
    await revoke_refresh_token(redis_conn, refresh_token_id)
    
    response = Response(content='{"message": "Logged out successfully"}', media_type="application/json")
    response.delete_cookie(key="access_token", samesite="lax")
    response.delete_cookie(key="refresh_token", samesite="lax")
    return response

@router.post("/auth/logout-all", tags=["auth"])
@limiter.limit(RateLimitConfig.AUTH_REFRESH)
async def logout_all(
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
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )
    
    await revoke_all_user_tokens(redis_conn, int(user_id))
    
    response = Response(content='{"message": "Logged out from all sessions successfully"}', media_type="application/json")
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


@router.post("/auth/get-private-key", tags=["auth"])
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
        "exp": datetime.now(timezone.utc) + timedelta(hours=1)
    }
    reset_token = jwt.encode(reset_token_data, SECRET_KEY, algorithm=JWTConfig.ALGORITHM)
    
    # TODO: zastanwowić się na jaki base url tutaj wskazywać
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
                detail="Nieprawidłowy token resetowania"
            )
        
        user = await get_user_by_email(db, email)
        sent_messages = await get_sent_messages(db, user.id) or []
        inbox_messages = await get_inbox_messages(db, user.id) or []

        # Po resecie hasła wiadomości nie są już odszyfrowywalne
        for msg, _ in sent_messages:
            msg.is_decryptable_sender = False
        for msg, _ in inbox_messages:
            msg.is_decryptable_receiver = False

        if not user or str(user.id) != user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Nieprawidłowy token resetowania"
            )
        
        user.password_hash = hash_password(reset_data.new_password)
        user.public_key = reset_data.public_key
        user.encrypted_private_key = reset_data.encrypted_private_key

        await revoke_all_user_tokens(redis_conn, int(user_id))

        await db.commit()
        
        logger.info(f"Hasło poprawnie zresetowane dla użytkownika {user.email}")
        
        return {"message": "Hasło zostało pomyślnie zresetowane"}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token resetowania wygasł"
        )
    except jwt.JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nieprawidłowy token resetowania"
        )
