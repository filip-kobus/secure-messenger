from passlib.hash import argon2
from app.config import HashingConfig

def hash_password(password: str) -> str:
    return argon2.using(
        type=HashingConfig.TYPE,
        salt_size=HashingConfig.SALT_SIZE,
        time_cost=HashingConfig.TIME_COST,
        memory_cost=HashingConfig.MEMORY_COST,
        parallelism=HashingConfig.PARALLELISM,
        digest_size=HashingConfig.DIGEST_SIZE,
    ).hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return argon2.verify(plain_password, hashed_password)