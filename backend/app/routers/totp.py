from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.models.user import User
from app.schemas.totp import TOTPVerifyRequest
from app.utils.totp_manager import generate_totp_secret, generate_qr_code, decrypt_totp_secret, encrypt_totp_secret, verify_totp_code
from app.utils.rate_limiter import limiter
from app.config import RateLimitConfig
from app.db import AsyncSession, get_db
from app.dependencies import get_current_user

router = APIRouter(prefix="/totp", tags=["totp"])

@router.post("/initialize")
@limiter.limit(RateLimitConfig.AUTH_REFRESH)
async def enable_totp(request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.is_2fa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP is already enabled for this user"
        )
    if user.totp_secret_encrypted:
        totp_secret = decrypt_totp_secret(user.totp_secret_encrypted)
        qr_code = generate_qr_code(username=user.username, secret=totp_secret)
        return {"message": "TOTP secret already exists", "qr_code": qr_code}
    else:
        totp_secret = generate_totp_secret()
        totp_secret_encrypted = encrypt_totp_secret(totp_secret)
        user.totp_secret_encrypted = totp_secret_encrypted
        await db.commit()
        await db.refresh(user)
    qr_code = generate_qr_code(username=user.username, secret=totp_secret)
    return {"message": "TOTP secret generated", "qr_code": qr_code, "secret": totp_secret}

@router.post("/enable")
@limiter.limit(RateLimitConfig.AUTH_REFRESH)
async def verify_totp(request: Request, totp_request: TOTPVerifyRequest, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if user.is_2fa_enabled:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP is already enabled for this user"
        )
    if not user.totp_secret_encrypted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="TOTP secret not initialized"
        )
    totp_secret = decrypt_totp_secret(user.totp_secret_encrypted)
    is_valid = verify_totp_code(totp_secret, totp_request.totp_code)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid TOTP code"
        )
    user.is_2fa_enabled = True
    await db.commit()
    await db.refresh(user)
    return {"message": "2FA enabled successfully"}