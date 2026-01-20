from fastapi import APIRouter, Depends, Request, HTTPException, status
from app.crud.users import get_user_by_username, get_user_by_id, list_all_users
from app.db import AsyncSession, get_db
from app.utils.rate_limiter import limiter
from app.config import RateLimitConfig

router = APIRouter()


@router.get("/users", tags=["users"])
@limiter.limit(RateLimitConfig.DEFAULT_LIMIT)
async def read_users(request: Request, db: AsyncSession = Depends(get_db)):
    users = await list_all_users(db)
    return [{
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "public_key": user.public_key
    } for user in users]


@router.get("/users/by-username/{username}", tags=["users"])
@limiter.limit(RateLimitConfig.DEFAULT_LIMIT)
async def get_user_by_username_endpoint(request: Request, username: str, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_username(db, username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "public_key": user.public_key
    }


@router.get("/users/{user_id}", tags=["users"])
@limiter.limit(RateLimitConfig.DEFAULT_LIMIT)
async def get_user_by_id_endpoint(request: Request, user_id: int, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "public_key": user.public_key
    }
