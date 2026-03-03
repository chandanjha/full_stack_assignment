from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient

from app.core.exception_handlers import (
    app_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.exceptions.app_exception import AppException


def build_test_app() -> FastAPI:
    app = FastAPI()
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)

    @app.get("/app-error")
    async def raise_app_error():
        raise AppException(
            status_code=403,
            message="Forbidden action",
            errors=[{"field": "book_id", "message": "Book is not available"}],
        )

    @app.get("/http-error")
    async def raise_http_error():
        raise HTTPException(status_code=404, detail="Book not found")

    @app.get("/crash")
    async def raise_unhandled_error():
        raise RuntimeError("boom")

    @app.get("/validate/{page}")
    async def validate_page(page: int):
        return {"page": page}

    return app


def test_app_exception_returns_standardized_error_payload():
    client = TestClient(build_test_app())

    response = client.get("/app-error")

    assert response.status_code == 403
    assert response.json() == {
        "success": False,
        "status_code": 403,
        "message": "Forbidden action",
        "errors": [
            {
                "field": "book_id",
                "message": "Book is not available",
            }
        ],
    }


def test_http_exception_returns_normalized_error_payload():
    client = TestClient(build_test_app())

    response = client.get("/http-error")

    assert response.status_code == 404
    assert response.json() == {
        "success": False,
        "status_code": 404,
        "message": "Book not found",
        "errors": [
            {
                "field": None,
                "message": "Book not found",
            }
        ],
    }


def test_validation_exception_uses_field_specific_errors():
    client = TestClient(build_test_app())

    response = client.get("/validate/not-a-number")

    assert response.status_code == 422
    payload = response.json()
    assert payload["success"] is False
    assert payload["status_code"] == 422
    assert payload["message"] == "Validation Error"
    assert payload["errors"][0]["field"] == "path.page"
    assert "integer" in payload["errors"][0]["message"].lower()


def test_unhandled_exception_returns_generic_500_payload():
    client = TestClient(build_test_app(), raise_server_exceptions=False)

    response = client.get("/crash")

    assert response.status_code == 500
    assert response.json() == {
        "success": False,
        "status_code": 500,
        "message": "Internal Server Error",
        "errors": [
            {
                "field": None,
                "message": "An unexpected error occurred.",
            }
        ],
    }
