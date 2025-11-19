from fastapi import APIRouter, Depends, HTTPException, status
from app.schemas.auth import LoginRequest, RegisterRequest
from app.models.users import User
from app.crud.users import get_user_by_email, create_user
from app.crud.tokens import add_refresh_token, check_refresh_token, revoke_refresh_token
from app.utils.password_hasher import verify_password, hash_password
from app.db import AsyncSession, get_db
from app.utils.tokens_manager import create_access_token, create_refresh_token, refresh_access_token

router = APIRouter()


@router.post("/login/", tags=["auth"])
async def login(login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, login_data.email)
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
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
async def register(register_data: RegisterRequest, db: AsyncSession = Depends(get_db)):
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
async def refresh_token_endpoint(refresh_token: str, db: AsyncSession = Depends(get_db)):
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
async def logout(refresh_token: str, db: AsyncSession = Depends(get_db)):
    db_token = await check_refresh_token(db, refresh_token)
    if db_token:
        await revoke_refresh_token(db, refresh_token)
    return {"message": "Logged out successfully"}
