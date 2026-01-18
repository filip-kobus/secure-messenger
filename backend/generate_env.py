import secrets
import os
from cryptography.fernet import Fernet

def generate_secret_key(length=64):
    return secrets.token_urlsafe(length)

def generate_fernet_key():
    return Fernet.generate_key().decode()

def main():
    env_path = os.path.join(os.path.dirname(__file__), '.env')
    
    if os.path.exists(env_path):
        response = input(f".env already exists. Overwrite? (y/N): ")
        if response.lower() != 'y':
            print("Cancelled.")
            return
    
    secret_key = generate_secret_key(64)
    totp_key = generate_fernet_key()
    
    env_content = f"""SECRET_KEY={secret_key}
TOTP_ENCRYPTION_KEY={totp_key}
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
"""
    
    with open(env_path, 'w') as f:
        f.write(env_content)
    
    print(f"✓ Generated .env file at {env_path}")
    print(f"  SECRET_KEY: {secret_key[:20]}...")
    print(f"  TOTP_ENCRYPTION_KEY: {totp_key[:20]}...")

if __name__ == "__main__":
    main()
