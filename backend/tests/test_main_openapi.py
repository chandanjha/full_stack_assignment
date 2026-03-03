from fastapi.testclient import TestClient

from main import app


def test_openapi_uses_error_response_for_422_validation_errors():
    client = TestClient(app)

    response = client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert "HTTPValidationError" not in schema["components"]["schemas"]
    assert "ValidationError" not in schema["components"]["schemas"]
    review_route = schema["paths"]["/api/v1/books/{book_id}/reviews"]["post"]
    assert review_route["responses"]["422"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorResponse"
    }
