from pydantic import BaseModel, Field

class TOTPVerifyRequest(BaseModel):
    totp_code: int = Field(
        min_length=6,
        max_length=6,
        pattern="^[0-9]{6}$",
        description="6-digit TOTP code"
    )
