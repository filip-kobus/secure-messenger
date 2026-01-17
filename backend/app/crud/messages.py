from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from app.models.message import Message
from app.models.user import User
from app.schemas.message import SendMessageRequest
from datetime import datetime

async def create_message(db: AsyncSession, message_in: SendMessageRequest, sender_id: int) -> Message:
    db_message = Message(
        sender_id=sender_id,
        receiver_id=message_in.receiver_id,
        encrypted_content=message_in.encrypted_content,
        encrypted_symmetric_key=message_in.encrypted_symmetric_key,
        encrypted_symmetric_key_sender=message_in.encrypted_symmetric_key_sender,
        signature=message_in.signature
    )
    db.add(db_message)
    await db.commit()
    await db.refresh(db_message)
    return db_message

async def get_inbox_messages(db: AsyncSession, receiver_id: int):
    # Join with User to get sender info for the response schema
    query = (
        select(Message, User.username)
        .join(User, Message.sender_id == User.id)
        .where(Message.receiver_id == receiver_id)
        .where(Message.deleted_by_receiver == False)
        .options(selectinload(Message.attachments)) # Attachments still have relationship
        .order_by(Message.created_at.desc())
    )
    result = await db.execute(query)
    # result is rows of (Message, username)
    return result.all()


async def get_sent_messages(db: AsyncSession, sender_id: int):
    # Join with User to get receiver info for the response schema
    query = (
        select(Message, User.username)
        .join(User, Message.receiver_id == User.id)
        .where(Message.sender_id == sender_id)
        .where(Message.deleted_by_sender == False)
        .options(selectinload(Message.attachments))
        .order_by(Message.created_at.desc())
    )
    result = await db.execute(query)
    return result.all()


async def get_message_by_id(db: AsyncSession, message_id: int) -> Message | None:
    query = select(Message).where(Message.id == message_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()

async def mark_message_read(db: AsyncSession, message_id: int):
    query = (
        update(Message)
        .where(Message.id == message_id)
        .values(is_read=True, read_at=datetime.utcnow())
    )
    await db.execute(query)
    await db.commit()


async def delete_message(db: AsyncSession, message_id: int, user_id: int):
    """
    Soft delete - oznacza wiadomość jako usuniętą dla danego użytkownika.
    Fizycznie usuwa tylko gdy obydwaj użytkownicy usunęli wiadomość.
    """
    query = select(Message).where(Message.id == message_id)
    result = await db.execute(query)
    message = result.scalar_one_or_none()
    
    if not message:
        return
    
    # Określ czy użytkownik jest nadawcą czy odbiorcą i ustaw odpowiednią flagę
    if message.sender_id == user_id:
        message.deleted_by_sender = True
    elif message.receiver_id == user_id:
        message.deleted_by_receiver = True
    
    # Jeśli obydwie strony usunęły wiadomość, usuń fizycznie
    if message.deleted_by_sender and message.deleted_by_receiver:
        await db.delete(message)
    
    await db.commit()
    
    return message
