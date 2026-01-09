import pyotp

def generate_valid_totp_code(secret: str) -> str:
    """Generuje aktualny kod TOTP."""
    totp = pyotp.TOTP(secret)
    return totp.now()

def create_mock_rsa_keys() -> tuple[str, str]:
    """Zwraca mock klucze RSA (dla testów bez prawdziwej kryptografii)."""
    public_key = "-----BEGIN PUBLIC KEY-----\nMOCK_PUBLIC\n-----END PUBLIC KEY-----"
    encrypted_private = "mock_encrypted_private_key"
    return public_key, encrypted_private