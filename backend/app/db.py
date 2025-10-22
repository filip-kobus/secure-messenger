from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base

from .config import DATABASE_URL, IS_DEBUG_ENABLED

Base = declarative_base()

engine = create_async_engine(DATABASE_URL, echo=IS_DEBUG_ENABLED)
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

async def get_db():
    async with SessionLocal() as session:
        yield session