import logging
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.exceptions.app_exception import AppException
from app.schemas.response import ErrorDetail, ErrorResponse

logger = logging.getLogger(__name__)


def _build_error_response(
    status_code: int,
    message: str,
    errors: list[ErrorDetail] | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        status_code=status_code,
        message=message,
        errors=errors or [],
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump())


def _normalize_error_items(raw_errors: Any) -> list[ErrorDetail]:
    if not raw_errors:
        return []

    normalized: list[ErrorDetail] = []
    items = raw_errors if isinstance(raw_errors, list) else [raw_errors]

    for item in items:
        if isinstance(item, ErrorDetail):
            normalized.append(item)
            continue

        if isinstance(item, dict):
            field = item.get("field")
            message = item.get("message") or item.get("msg") or item.get("detail") or "Request failed"
            normalized.append(
                ErrorDetail(
                    field=str(field) if field is not None else None,
                    message=str(message),
                )
            )
            continue

        normalized.append(ErrorDetail(message=str(item)))

    return normalized


async def app_exception_handler(_: Request, exc: AppException) -> JSONResponse:
    return _build_error_response(
        status_code=exc.status_code,
        message=exc.message,
        errors=_normalize_error_items(exc.errors),
    )


async def http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    errors = _normalize_error_items(exc.detail)
    if errors:
        message = errors[0].message if len(errors) == 1 else "Request failed"
    else:
        message = "Request failed"
    return _build_error_response(
        status_code=exc.status_code,
        message=message,
        errors=errors or [ErrorDetail(message=message)],
    )


async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors: list[ErrorDetail] = []

    for err in exc.errors():
        field = ".".join(str(loc) for loc in err["loc"] if loc != "body")
        errors.append(
            ErrorDetail(
                field=field or None,
                message=err["msg"],
            )
        )

    return _build_error_response(
        status_code=422,
        message="Validation Error",
        errors=errors,
    )


async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled application error", exc_info=exc)
    return _build_error_response(
        status_code=500,
        message="Internal Server Error",
        errors=[ErrorDetail(message="An unexpected error occurred.")],
    )
