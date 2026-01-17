from fastapi import Depends, FastAPI
from sqlalchemy.exc import SQLAlchemyError

from app.dependencies import verify_access_token
from app.routers import users, auth, totp, messages
from app.exceptions import ExceptionHandlers

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.utils.rate_limiter import limiter
from fastapi.middleware.cors import CORSMiddleware


origins = [
    "http://localhost.tiangolo.com",
    "https://localhost.tiangolo.com",
    "http://localhost",
    "http://localhost:8080",
    "http://localhost:4200",
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.state.limiter = limiter

app.add_exception_handler(SQLAlchemyError, ExceptionHandlers.sqlalchemy_exception_handler)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(users.router, dependencies=[Depends(verify_access_token)])
app.include_router(messages.router, dependencies=[Depends(verify_access_token)])
# Totp has inline dependency on get_current_user
app.include_router(totp.router)
app.include_router(auth.router)


@app.get("/")
async def root():
    return {"message": "Welcome in Secure Messenger!"}
