from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import relationship
from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    totp_secret = Column(String, nullable=True)
    is_2fa_enabled = Column(Boolean, default=False)

    refresh_tokens = relationship("RefreshToken", back_populates="user")
