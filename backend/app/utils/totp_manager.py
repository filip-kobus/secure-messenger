import pyotp
import qrcode
from io import BytesIO
import base64
from app.config import TOTP_ENCRYPTION_KEY
from cryptography.fernet import Fernet


def generate_totp_secret() -> str:
    return pyotp.random_base32()

def encrypt_totp_secret(secret: str) -> str:
    fernet = Fernet(TOTP_ENCRYPTION_KEY.encode())
    encrypted = fernet.encrypt(secret.encode())
    return encrypted.decode()

def decrypt_totp_secret(encrypted_secret: str) -> str:
    fernet = Fernet(TOTP_ENCRYPTION_KEY.encode())
    decrypted = fernet.decrypt(encrypted_secret.encode())
    return decrypted.decode()

def generate_qr_code(username: str, secret: str, issuer: str = "SecureMessenger") -> str:
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=username, issuer_name=issuer)
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

def verify_totp_code(secret: str, code: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=1)
