from fastapi import APIRouter, Depends
from app.schemas.auth import LoginRequest, RegisterRequest
from app.models.users import User
from app.crud.users import get_user_by_email, create_user
from app.utils.hash_password import verify_password, hash_password
from app.db import AsyncSession, get_db

router = APIRouter()


@router.post("/login/", tags=["auth"])
async def login(login_data: LoginRequest, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, login_data.email)
    if user and verify_password(login_data.password, user.password_hash):
        return {"message": "User logged in successfully"}
    return {"message": "Invalid email or password"}, 401


@router.post("/register/", tags=["auth"])
async def register(register_data: RegisterRequest, db: AsyncSession = Depends(get_db)):
    hashed_password = hash_password(register_data.password)
    user = User(
        username=register_data.username,
        email=register_data.email,
        password_hash=hashed_password,
    )

    await create_user(db, user)

    return {"message": "User registered successfully"}
