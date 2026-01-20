from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError, IntegrityError, OperationalError


class ExceptionHandlers:
    @staticmethod
    async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
        """Generic handler for all SQLAlchemy errors"""
        if isinstance(exc, IntegrityError):
            return JSONResponse(
                status_code=409,
                content={"detail": "Konflikt danych. Zasób może już istnieć."},
            )
        elif isinstance(exc, OperationalError):
            return JSONResponse(
                status_code=503,
                content={"detail": "Baza danych niedostępna. Proszę spróbować później."},
            )
        else:
            return JSONResponse(
                status_code=500,
                content={"detail": "Wystąpił błąd bazy danych."},
            )
