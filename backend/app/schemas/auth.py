from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.config import UserCredentialsConfig
import re


class LoginRequest(BaseModel):
    email: EmailStr = Field(max_length=UserCredentialsConfig.EMAIL_MAX_LENGTH)
    password: str = Field(
        min_length=1, max_length=UserCredentialsConfig.PASSWORD_MAX_LENGTH
    )
    totp_code: Optional[str] = Field(
        None,
        min_length=6,
        max_length=6,
    )

class LogoutRequest(BaseModel):
    refresh_token: str

class RegisterRequest(BaseModel):
    username: str = Field(
        min_length=UserCredentialsConfig.USERNAME_MIN_LENGTH,
        max_length=UserCredentialsConfig.USERNAME_MAX_LENGTH,
        pattern=r"^[a-zA-Z0-9_-]+$",
    )
    email: EmailStr = Field(max_length=UserCredentialsConfig.EMAIL_MAX_LENGTH)
    password: str = Field(
        min_length=UserCredentialsConfig.PASSWORD_MIN_LENGTH,
        max_length=UserCredentialsConfig.PASSWORD_MAX_LENGTH,
    )

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """Validate password strength"""
        if UserCredentialsConfig.REQUIRE_UPPERCASE and not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if UserCredentialsConfig.REQUIRE_LOWERCASE and not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if UserCredentialsConfig.REQUIRE_DIGIT and not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if UserCredentialsConfig.REQUIRE_SPECIAL and not re.search(
            r"[!@#$%^&*(),.?\":{}|<>]", v
        ):
            raise ValueError("Password must contain at least one special character")
        return v
    
    public_key: str = Field(description="RSA public key in PEM format")
    encrypted_private_key: str = Field(description="RSA private key encrypted with user password")


class TwoFactorVerifyRequest(BaseModel):
    user_id: int
    code: str


class TwoFactorEnableResponse(BaseModel):
    secret: str
    qr_code: str