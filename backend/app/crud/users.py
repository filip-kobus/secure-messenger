from app.models.user import User
from app.models.refreshtoken import RefreshToken
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))

    user = result.scalar_one_or_none()
    return user


async def create_user(db: AsyncSession, user: User) -> User:
    new_user = User(
        username=user.username, email=user.email, password_hash=user.password_hash
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user


async def add_refresh_token_to_user(
    db: AsyncSession, user: User, refresh_token: str
) -> None:
    refresh_token = RefreshToken(
        user_id=user.id,
        token=refresh_token,
    )
    db.add(refresh_token)
    await db.commit()

async def list_usernames(db: AsyncSession) -> list[str]:
    result = await db.execute(select(User.username))
    usernames = result.scalars().all()
    return usernames

async def enable_totp_for_user(db: AsyncSession, user: User) -> None:
    user.is_2fa_enabled = True
    await db.commit()
    await db.refresh(user)

async def disable_totp_for_user(db: AsyncSession, user: User) -> None:
    user.totp_secret_encrypted = None
    user.is_2fa_enabled = False
    await db.commit()
    await db.refresh(user)

async def set_totp_secret(db: AsyncSession, user: User, totp_secret_encrypted: str) -> None:
    user.totp_secret_encrypted = totp_secret_encrypted
    await db.commit()
    await db.refresh(user)
