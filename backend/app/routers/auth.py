from fastapi import APIRouter
from app.schemas.auth import LoginRequest, RegisterRequest

router = APIRouter()


@router.post("/login/", tags=["auth"])
async def login(login_data: LoginRequest):
    return {"message": "User logged in successfully"}


@router.post("/register/", tags=["auth"])
async def register(register_data: RegisterRequest):
    return {"message": "User registered successfully"}
