from fastapi import APIRouter, Depends, Request
from app.crud.users import list_usernames
from app.db import AsyncSession, get_db
from app.utils.rate_limiter import limiter
from app.config import RateLimitConfig

router = APIRouter()


@router.get("/users", tags=["users"])
@limiter.limit(RateLimitConfig.DEFAULT_LIMIT)
async def read_users(request: Request, db: AsyncSession = Depends(get_db)):
    usernames = await list_usernames(db)
    return [{"username": username} for username in usernames]
