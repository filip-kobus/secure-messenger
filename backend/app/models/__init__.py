"""
Models package - imports all models to ensure SQLAlchemy mapper configuration.
"""
from app.models.user import User
from app.models.message import Message
from app.models.attachment import Attachment

__all__ = ["User", "Message", "Attachment"]
