from dotenv import load_dotenv
import os

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise ValueError("SECRET_KEY environment variable is not set")

TOTP_ENCRYPTION_KEY = os.getenv("TOTP_ENCRYPTION_KEY")
if not TOTP_ENCRYPTION_KEY:
    raise ValueError("TOTP_ENCRYPTION_KEY environment variable is not set")

DATABASE_URL = "sqlite+aiosqlite:///./db.sqlite3"
IS_DEBUG_ENABLED = True

REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_DB = int(os.getenv("REDIS_DB", "0"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)


class RateLimitConfig:
    AUTH_ATTEMPTS = "10/hour"
    DEFAULT_LIMIT = "100/minute"
    AUTH_LOGIN = "5/minute"
    AUTH_REGISTER = "5/minute"
    AUTH_REFRESH = "100/minute"
    MESSAGES_SEND = "20/minute"
    MESSAGES_FETCH = "60/minute"
    ADMIN = "10/minute"


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
