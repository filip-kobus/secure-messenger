import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    """Test rejestracji nowego użytkownika."""
    response = await client.post("/auth/register/", json={
        "username": "newuser",
        "email": "new@example.com",
        "password": "SecurePass123!",
        "public_key": "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
        "encrypted_private_key": "encrypted_key_here"
    })
    assert response.status_code == 200
    assert response.json()["message"] == "User registered successfully"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, test_user):
    """Test rejestracji z istniejącym emailem."""
    response = await client.post("/auth/register/", json={
        "username": "another",
        "email": test_user.email,
        "password": "SecurePass123!",
        "public_key": "-----BEGIN PUBLIC KEY-----\nTEST\n-----END PUBLIC KEY-----",
        "encrypted_private_key": "encrypted_key_here"
    })
    assert response.status_code == 409
    assert "already registered" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_user):
    """Test poprawnego logowania."""
    response = await client.post("/auth/login/", json={
        "email": test_user.email,
        "password": "TestPass123!"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_user):
    """Test logowania ze złym hasłem."""
    response = await client.post("/auth/login/", json={
        "email": test_user.email,
        "password": "WrongPassword123!"
    })
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


@pytest.mark.asyncio
async def test_login_2fa_required(client: AsyncClient, test_user_with_2fa):
    """Test logowania z włączonym 2FA bez kodu."""
    user, _ = test_user_with_2fa
    response = await client.post("/auth/login/", json={
        "email": user.email,
        "password": "TestPass123!"
    })
    assert response.status_code == 403
    assert "TOTP code required" in response.json()["detail"]
    assert response.headers.get("X-Requires-2FA") == "true"


@pytest.mark.asyncio
async def test_login_2fa_with_valid_code(client: AsyncClient, test_user_with_2fa):
    """Test logowania z 2FA i poprawnym kodem."""
    import pyotp
    user, plain_secret = test_user_with_2fa
    totp = pyotp.TOTP(plain_secret)
    code = totp.now()
    
    response = await client.post("/auth/login/", json={
        "email": user.email,
        "password": "TestPass123!",
        "totp_code": code
    })
    assert response.status_code == 200
    assert "access_token" in response.json()