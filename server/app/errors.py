"""Stable, localized errors without exposing request bodies or provider details."""
import logging
import sqlite3

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from .localization import resolve_locale, translate
from .schemas import ErrorDetail, ErrorResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    def __init__(self, status: int, message_key: str):
        self.status = status
        self.message_key = message_key


def error_response(request: Request, status: int, message_key: str, *, code: str | None = None,
                   fields: list[str] | None = None, headers: dict[str, str] | None = None):
    payload = ErrorResponse(error=ErrorDetail(
        code=code or f'HTTP_{status}',
        message=translate(message_key, resolve_locale(request.headers.get('accept-language'))),
        fields=fields or [],
    ))
    return JSONResponse(status_code=status, content=payload.model_dump(), headers=headers)


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def application_error(request: Request, exc: AppError):
        return error_response(request, exc.status, exc.message_key)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError):
        fields = list(dict.fromkeys(
            '.'.join(str(part) for part in error['loc'] if part != 'body') for error in exc.errors()
        ))
        return error_response(request, 422, 'validation', code='VALIDATION_ERROR', fields=fields)

    @app.exception_handler(HTTPException)
    async def http_error(request: Request, exc: HTTPException):
        return error_response(request, exc.status_code, 'not_found' if exc.status_code == 404 else 'http_error', headers=exc.headers)

    @app.exception_handler(sqlite3.OperationalError)
    async def database_error(request: Request, exc: sqlite3.OperationalError):
        # Extended SQLite result codes retain the primary code in the low byte.
        code = getattr(exc, 'sqlite_errorcode', 0) or 0
        if code & 0xFF in (sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED):
            return error_response(request, 503, 'database_busy', headers={'Retry-After': '1'})
        logger.error('Database operation failed: %s', type(exc).__name__)
        return error_response(request, 500, 'internal_error')

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception):
        logger.error('Request failed: %s', type(exc).__name__)
        return error_response(request, 500, 'internal_error')
