import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_initialize_totp(client: AsyncClient, auth_headers):
    """Test inicjalizacji TOTP."""
    response = await client.post("/totp/initialize", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "qr_code" in data
    assert "secret" in data
    assert data["secret"].isalnum()  # Base32 secret


@pytest.mark.asyncio
async def test_enable_totp_with_valid_code(client: AsyncClient, auth_headers, test_user, db_session):
    """Test włączenia 2FA z poprawnym kodem."""
    import pyotp
    
    # 1. Inicjalizuj TOTP
    init_response = await client.post("/totp/initialize", headers=auth_headers)
    plain_secret = init_response.json()["secret"]
    
    # 2. Generuj kod
    totp = pyotp.TOTP(plain_secret)
    code = totp.now()
    
    # 3. Włącz 2FA
    response = await client.post("/totp/enable", headers=auth_headers, json={
        "totp_code": code
    })
    assert response.status_code == 200
    assert "2FA enabled successfully" in response.json()["message"]
    
    # 4. Sprawdź w bazie
    await db_session.refresh(test_user)
    assert test_user.is_2fa_enabled is True


@pytest.mark.asyncio
async def test_enable_totp_with_invalid_code(client: AsyncClient, auth_headers):
    """Test włączenia 2FA ze złym kodem."""
    # Inicjalizuj
    await client.post("/totp/initialize", headers=auth_headers)
    
    # Spróbuj włączyć ze złym kodem
    response = await client.post("/totp/enable", headers=auth_headers, json={
        "totp_code": "000000"
    })
    assert response.status_code == 401
    assert "Invalid TOTP code" in response.json()["detail"]