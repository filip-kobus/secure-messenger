import asyncio
from app.db import engine, Base

from app.models import users

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

asyncio.run(main())