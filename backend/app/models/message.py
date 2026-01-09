from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, LargeBinary
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db import Base


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    encrypted_content = Column(Text, nullable=False)
    
    encrypted_symmetric_key = Column(Text, nullable=False)
    
    signature = Column(Text, nullable=False)
    
    created_at = Column(DateTime, server_default=func.now())
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime, nullable=True)
    
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")
    attachments = relationship("Attachment", back_populates="message", cascade="all, delete-orphan")