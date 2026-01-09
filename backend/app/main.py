from fastapi import Depends, FastAPI
from sqlalchemy.exc import SQLAlchemyError

from app.dependencies import get_token_header, verify_access_token
from app.routers import users, auth, totp
from app.exceptions import ExceptionHandlers

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.utils.rate_limiter import limiter

app = FastAPI()

app.state.limiter = limiter

app.add_exception_handler(SQLAlchemyError, ExceptionHandlers.sqlalchemy_exception_handler)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(users.router, dependencies=[Depends(verify_access_token)])
# Not all routes in totp require token verification so no global dependency here
app.include_router(totp.router)
app.include_router(auth.router)


@app.get("/")
async def root():
    return {"message": "Welcome in Secure Messenger!"}
