from app.models.refreshtoken import RefreshToken
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from datetime import datetime, timezone
from app.utils.tokens_manager import is_token_expired


async def add_refresh_token(db: AsyncSession, user_id: int, token: str):
    refresh_token = RefreshToken(
        user_id=user_id,
        token=token,
        created_at=datetime.now(timezone.utc),
        revoked=False
    )
    db.add(refresh_token)
    await db.commit()
    await db.refresh(refresh_token)
    return refresh_token

async def revoke_refresh_token(db: AsyncSession, token: str):
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.token == token)
        .values(revoked=True)
    )
    await db.commit()

async def check_refresh_token(db: AsyncSession, token: str) -> RefreshToken | None:
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == token,
            not RefreshToken.revoked
        )
    )
    db_token = result.scalar_one_or_none()
    
    if db_token and is_token_expired(token):
        await revoke_refresh_token(db, token)
        return None
    
    return db_token

async def delete_refresh_token(db: AsyncSession, token: str):
    await db.execute(delete(RefreshToken).where(RefreshToken.token == token))
    await db.commit()
