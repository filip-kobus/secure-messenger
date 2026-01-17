from pydantic import BaseModel, Field
from datetime import datetime

class SendMessageRequest(BaseModel):
    receiver_id: int
    encrypted_content: str
    encrypted_symmetric_key: str
    encrypted_symmetric_key_sender: str | None = None
    signature: str
    attachments: list["AttachmentData"] | None = None

class AttachmentData(BaseModel):
    encrypted_data: str
    filename: str
    mime_type: str
    size: int = Field(gt=0, le=10_000_000)

class MessageResponse(BaseModel):
    id: int
    sender_id: int
    sender_username: str
    recipient_id: int | None = None
    recipient_username: str | None = None
    encrypted_content: str
    encrypted_symmetric_key: str
    encrypted_symmetric_key_sender: str | None = None
    signature: str
    created_at: datetime
    is_read: bool
    attachments: list["AttachmentResponse"]

class AttachmentResponse(BaseModel):
    id: int
    filename: str
    mime_type: str
    size: int
