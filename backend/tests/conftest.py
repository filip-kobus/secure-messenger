import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import redis.asyncio as redis
from unittest.mock import AsyncMock

from app.main import app
from app.db import Base, get_db
from app.dependencies import get_redis
from app.models import User, Message, Attachment
from app.utils.password_hasher import hash_password

# Baza testowa w pamięci
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture(autouse=True)
async def cleanup():
    """Automatyczne czyszczenie przed i po każdym teście."""
    app.dependency_overrides.clear()
    app.state.limiter._storage.storage.clear()
    yield
    app.dependency_overrides.clear()
    app.state.limiter._storage.storage.clear()

@pytest_asyncio.fixture
async def db_session():
    """Tworzy czystą bazę danych dla każdego testu."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    
    async with async_session() as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    
    await engine.dispose()


@pytest_asyncio.fixture
async def redis_session():
    redis_mock = AsyncMock(spec=redis.Redis)
    redis_mock.storage = {}
    
    async def mock_setex(key, time, value):
        redis_mock.storage[key] = value
    
    async def mock_get(key):
        return redis_mock.storage.get(key)
    
    async def mock_delete(*keys):
        for key in keys:
            redis_mock.storage.pop(key, None)
    
    async def mock_exists(key):
        return 1 if key in redis_mock.storage else 0
    
    async def mock_sadd(key, *values):
        if key not in redis_mock.storage:
            redis_mock.storage[key] = set()
        if isinstance(redis_mock.storage[key], str):
            redis_mock.storage[key] = set()
        for v in values:
            redis_mock.storage[key].add(v)
    
    async def mock_smembers(key):
        return redis_mock.storage.get(key, set())
    
    async def mock_srem(key, *values):
        if key in redis_mock.storage and isinstance(redis_mock.storage[key], set):
            for v in values:
                redis_mock.storage[key].discard(v)
    
    async def mock_expire(key, time):
        pass
    
    redis_mock.setex = mock_setex
    redis_mock.get = mock_get
    redis_mock.delete = mock_delete
    redis_mock.exists = mock_exists
    redis_mock.sadd = mock_sadd
    redis_mock.smembers = mock_smembers
    redis_mock.srem = mock_srem
    redis_mock.expire = mock_expire
    
    yield redis_mock
    redis_mock.storage.clear()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession, redis_session):
    """FastAPI test client z nadpisaną bazą danych i Redis."""
    from httpx import ASGITransport
    
    app.dependency_overrides.clear()
    
    async def override_get_db():
        yield db_session
    
    async def override_get_redis():
        return redis_session
    
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_redis] = override_get_redis
    
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession):
    """Tworzy testowego użytkownika."""
    user = User(
        username="testuser",
        email="test@example.com",
        password_hash=hash_password("TestPass123!"),
        public_key="-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
        encrypted_private_key="encrypted_test_key",
        is_2fa_enabled=False
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def test_user_with_2fa(db_session: AsyncSession):
    """Tworzy użytkownika z włączonym 2FA."""
    from app.utils.totp_manager import generate_totp_secret, encrypt_totp_secret
    
    plain_secret = generate_totp_secret()
    encrypted_secret = encrypt_totp_secret(plain_secret)
    
    user = User(
        username="user2fa",
        email="2fa@example.com",
        password_hash=hash_password("TestPass123!"),
        public_key="-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
        encrypted_private_key="encrypted_test_key",
        totp_secret_encrypted=encrypted_secret,
        is_2fa_enabled=True
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user, plain_secret


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, test_user: User):
    """Zwraca nagłówki z tokenem JWT."""
    response = await client.post("/auth/login", json={
        "email": test_user.email,
        "password": "TestPass123!"
    })
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}