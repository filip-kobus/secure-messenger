import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_send_message(client: AsyncClient, auth_headers, test_user, db_session):
    """Test wysłania wiadomości."""
    # Utwórz drugiego użytkownika (odbiorca)
    from app.models.user import User
    from app.utils.password_hasher import hash_password
    
    receiver = User(
        username="receiver",
        email="receiver@example.com",
        password_hash=hash_password("Pass123!"),
        public_key="-----BEGIN PUBLIC KEY-----\nRECEIVER\n-----END PUBLIC KEY-----",
        encrypted_private_key="encrypted"
    )
    db_session.add(receiver)
    await db_session.commit()
    await db_session.refresh(receiver)
    
    # Wyślij wiadomość
    response = await client.post("/messages/send", headers=auth_headers, json={
        "receiver_id": receiver.id,
        "encrypted_content": "encrypted_message_here",
        "encrypted_symmetric_key": "encrypted_aes_key",
        "signature": "digital_signature_here"
    })
    assert response.status_code == 200
    assert "message_id" in response.json()


@pytest.mark.asyncio
async def test_get_inbox(client: AsyncClient, auth_headers, test_user, db_session):
    """Test pobierania skrzynki odbiorczej."""
    # Utwórz nadawcę i wiadomość
    from app.models.user import User
    from app.models.message import Message
    from app.utils.password_hasher import hash_password
    
    sender = User(
        username="sender",
        email="sender@example.com",
        password_hash=hash_password("Pass123!"),
        public_key="-----BEGIN PUBLIC KEY-----\nSENDER\n-----END PUBLIC KEY-----",
        encrypted_private_key="encrypted"
    )
    db_session.add(sender)
    await db_session.commit()
    await db_session.refresh(sender)
    
    message = Message(
        sender_id=sender.id,
        receiver_id=test_user.id,
        encrypted_content="encrypted",
        encrypted_symmetric_key="key",
        signature="sig"
    )
    db_session.add(message)
    await db_session.commit()
    
    # Pobierz inbox
    response = await client.get("/messages/inbox", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_mark_message_as_read(client: AsyncClient, auth_headers, test_user, db_session):
    """Test oznaczania wiadomości jako przeczytanej."""
    from app.models.user import User
    from app.models.message import Message
    from app.utils.password_hasher import hash_password
    
    sender = User(
        username="sender2",
        email="sender2@example.com",
        password_hash=hash_password("Pass123!"),
        public_key="-----BEGIN PUBLIC KEY-----\nSENDER\n-----END PUBLIC KEY-----",
        encrypted_private_key="encrypted"
    )
    db_session.add(sender)
    await db_session.commit()
    await db_session.refresh(sender)
    
    message = Message(
        sender_id=sender.id,
        receiver_id=test_user.id,
        encrypted_content="encrypted",
        encrypted_symmetric_key="key",
        signature="sig",
        is_read=False
    )
    db_session.add(message)
    await db_session.commit()
    await db_session.refresh(message)
    
    # Oznacz jako przeczytane
    response = await client.post(f"/messages/{message.id}/read", headers=auth_headers)
    assert response.status_code == 200
    
    # Sprawdź w bazie
    await db_session.refresh(message)
    assert message.is_read is True
    assert message.read_at is not None