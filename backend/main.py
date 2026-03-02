from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api import router as api_router
from app.core.settings import settings
from app.core.exception_handlers import (
    app_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.exceptions.app_exception import AppException
from app.schemas.response import ErrorResponse

app = FastAPI(title="LuminaLib API", version="1.0.0", description="API for book recommendations, reviews, and user management.")

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)


def custom_openapi() -> dict:
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        openapi_version=app.openapi_version,
        description=app.description,
        routes=app.routes,
    )

    components = openapi_schema.setdefault("components", {})
    schemas = components.setdefault("schemas", {})

    error_response_schema = ErrorResponse.model_json_schema(
        ref_template="#/components/schemas/{model}",
    )
    error_schema_defs = error_response_schema.pop("$defs", {})
    schemas.update(error_schema_defs)
    schemas["ErrorResponse"] = error_response_schema
    schemas.pop("HTTPValidationError", None)
    schemas.pop("ValidationError", None)

    for path_item in openapi_schema.get("paths", {}).values():
        for operation in path_item.values():
            if not isinstance(operation, dict):
                continue

            responses = operation.get("responses", {})
            if "422" not in responses:
                continue

            responses["422"] = {
                "description": "Validation Error",
                "content": {
                    "application/json": {
                        "schema": {"$ref": "#/components/schemas/ErrorResponse"},
                    }
                },
            }

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")
