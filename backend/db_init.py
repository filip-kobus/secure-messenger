import asyncio
from app.db import engine, Base
# Import all models to ensure they're registered with SQLAlchemy
from app.models import User, Message, Attachment  # noqa: F401


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


asyncio.run(main())
