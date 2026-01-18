from fastapi import Depends, FastAPI, Request, Response
from sqlalchemy.exc import SQLAlchemyError
from starlette.middleware.base import BaseHTTPMiddleware
import uuid

from app.dependencies import verify_access_token, close_redis
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

class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        csrf_token = request.cookies.get("XSRF-TOKEN")
        force_set_cookie = False

        if request.url.path in ["/auth/login", "/auth/refresh-token", "/auth/register", "/auth/logout"]:
            response = await call_next(request)
            if request.url.path == "/auth/login" and not csrf_token:
                csrf_token = str(uuid.uuid4())
                response.set_cookie(
                    key="XSRF-TOKEN", 
                    value=csrf_token, 
                    httponly=False, 
                    samesite="lax",
                    secure=False
                )
            return response

        if not csrf_token:
            csrf_token = str(uuid.uuid4())
            force_set_cookie = True

        if request.method not in ["GET", "HEAD", "OPTIONS", "TRACE"]:
            csrf_header = request.headers.get("X-XSRF-TOKEN")
            if not csrf_header or csrf_header != csrf_token:
                return Response(content="CSRF Token mismatch or missing", status_code=403)

        response = await call_next(request)

        if force_set_cookie:
            response.set_cookie(
                key="XSRF-TOKEN", 
                value=csrf_token, 
                httponly=False, 
                samesite="lax",
                secure=False
            )
            
        return response

app = FastAPI()

app.add_middleware(CSRFMiddleware)

@app.on_event("shutdown")
async def shutdown_event():
    await close_redis()

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
