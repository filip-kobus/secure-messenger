from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY")
DATABASE_URL = "sqlite+aiosqlite:///./db.sqlite3"
IS_DEBUG_ENABLED = True


class JWTConfig:
    ALGORITHM = "HS256"
    ACCESS_EXPIRE_MINUTES = 15
    REFRESH_EXPIRE_DAYS = 7


class UserCredentialsConfig:
    USERNAME_MIN_LENGTH = 3
    USERNAME_MAX_LENGTH = 50
    PASSWORD_MIN_LENGTH = 8
    PASSWORD_MAX_LENGTH = 64
    EMAIL_MAX_LENGTH = 254
    REQUIRE_UPPERCASE = True
    REQUIRE_LOWERCASE = True
    REQUIRE_DIGIT = True
    REQUIRE_SPECIAL = True


class HashingConfig:
    ALGORITHM = "argon2"
    TYPE = "ID"
    SALT_SIZE = 16
    TIME_COST = 2
    MEMORY_COST = 65536
    PARALLELISM = 4
    DIGEST_SIZE = 32
    MAX_THREADS = -1
