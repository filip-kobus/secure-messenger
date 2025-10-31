from fastapi import Depends, FastAPI
from sqlalchemy.exc import SQLAlchemyError

from app.dependencies import get_query_token, get_token_header
from app.internal import admin
from app.routers import items, users, auth
from app.exceptions import ExceptionHandlers


app = FastAPI()

app.add_exception_handler(
    SQLAlchemyError, ExceptionHandlers.sqlalchemy_exception_handler
)

app.include_router(users.router, dependencies=[Depends(get_query_token)])
app.include_router(items.router, dependencies=[Depends(get_query_token)])
app.include_router(auth.router)
app.include_router(
    admin.router,
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(get_token_header)],
    responses={418: {"description": "I'm a teapot"}},
)


@app.get("/")
async def root():
    return {"message": "Hello Bigger Applications!"}
