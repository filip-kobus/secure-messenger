import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db import Base, get_db
from app.models.user import User
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
async def client(db_session: AsyncSession):
    """FastAPI test client z nadpisaną bazą danych."""
    from httpx import ASGITransport
    
    app.dependency_overrides.clear()
    
    async def override_get_db():
        yield db_session
    
    app.dependency_overrides[get_db] = override_get_db
    
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