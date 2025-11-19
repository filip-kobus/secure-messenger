from fastapi import APIRouter, Depends
from app.crud.users import list_usernames
from app.db import AsyncSession, get_db

router = APIRouter()


@router.get("/users/", tags=["users"])
async def read_users(db: AsyncSession = Depends(get_db)):
    usernames = await list_usernames(db)
    return [{"username": username} for username in usernames]
