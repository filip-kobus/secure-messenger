from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import base64

from app.db import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.attachment import Attachment
from app.schemas.message import MessageResponse, SendMessageRequest
from app.crud.messages import create_message, get_inbox_messages, get_sent_messages, get_message_by_id, mark_message_read, delete_message
from sqlalchemy import select

router = APIRouter(prefix="/messages", tags=["messages"])

@router.post("/send", response_model=dict)
async def send_message(
    message_in: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if message_in.receiver_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send message to yourself")

    query = select(User).where(User.id == message_in.receiver_id)
    result = await db.execute(query)
    receiver = result.scalar_one_or_none()
    
    if not receiver:
        raise HTTPException(status_code=404, detail="Receiver not found")

    message = await create_message(db, message_in, current_user.id)
    return {"message_id": message.id}

@router.get("/inbox", response_model=List[MessageResponse])
async def get_inbox(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    rows = await get_inbox_messages(db, current_user.id)
    
    # rows contains (Message, sender_username)
    response = []
    for message, sender_username in rows:
        # Map attachments to response schema
        attachment_responses = []
        if message.attachments:
            for att in message.attachments:
                attachment_responses.append({
                    "id": att.id,
                    "filename": att.filename,
                    "mime_type": att.mime_type,
                    "size": att.size
                })
        
        response.append(MessageResponse(
            id=message.id,
            sender_id=message.sender_id,
            sender_username=sender_username,
            encrypted_content=message.encrypted_content,
            encrypted_symmetric_key=message.encrypted_symmetric_key,
            encrypted_symmetric_key_sender=message.encrypted_symmetric_key_sender,
            signature=message.signature,
            created_at=message.created_at,
            is_read=message.is_read,
            is_decryptable_receiver=message.is_decryptable_receiver,
            is_decryptable_sender=message.is_decryptable_sender,
            attachments=attachment_responses
        ))

    return response

@router.get("/sent", response_model=List[MessageResponse])
async def get_sent(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    rows = await get_sent_messages(db, current_user.id)
    
    # rows contains (Message, receiver_username)
    response = []
    for message, receiver_username in rows:
        # Map attachments to response schema
        attachment_responses = []
        if message.attachments:
            for att in message.attachments:
                attachment_responses.append({
                    "id": att.id,
                    "filename": att.filename,
                    "mime_type": att.mime_type,
                    "size": att.size
                })
        
        response.append(MessageResponse(
            id=message.id,
            sender_id=message.sender_id,
            sender_username=current_user.username,
            recipient_id=message.receiver_id,
            recipient_username=receiver_username,
            encrypted_content=message.encrypted_content,
            encrypted_symmetric_key=message.encrypted_symmetric_key,
            encrypted_symmetric_key_sender=message.encrypted_symmetric_key_sender,
            signature=message.signature,
            created_at=message.created_at,
            is_decryptable_receiver=message.is_decryptable_receiver,
            is_decryptable_sender=message.is_decryptable_sender,
            is_read=message.is_read,
            attachments=attachment_responses
        ))

    return response

@router.post("/{message_id}/read")
async def mark_as_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    message = await get_message_by_id(db, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    await mark_message_read(db, message_id)
    return {"status": "success"}


@router.delete("/{message_id}")
async def delete_message_endpoint(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    message = await get_message_by_id(db, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Użytkownik może usunąć wiadomość tylko jeśli jest jej nadawcą lub odbiorcą
    if message.sender_id != current_user.id and message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await delete_message(db, message_id, current_user.id)
    return {"status": "success", "message": "Message deleted"}


@router.get("/attachments/{attachment_id}")
async def get_attachment(
    attachment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Pobiera zaszyfrowaną zawartość załącznika"""
    query = select(Attachment).where(Attachment.id == attachment_id)
    result = await db.execute(query)
    attachment = result.scalar_one_or_none()
    
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Sprawdź uprawnienia - pobierz wiadomość do której należy załącznik
    message = await get_message_by_id(db, attachment.message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    # Użytkownik musi być nadawcą lub odbiorcą wiadomości
    if message.sender_id != current_user.id and message.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Zwróć zaszyfrowaną zawartość jako base64
    encrypted_base64 = base64.b64encode(attachment.encrypted_data).decode('utf-8')
    
    return {
        "id": attachment.id,
        "filename": attachment.filename,
        "mime_type": attachment.mime_type,
        "size": attachment.size,
        "encrypted_data": encrypted_base64
    }
