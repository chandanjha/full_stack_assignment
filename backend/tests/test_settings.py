import pytest

from app.core.settings import Settings


@pytest.mark.parametrize(
    ("raw_value", "expected"),
    [
        ('["http://localhost:3000","http://127.0.0.1:3000"]', ["http://localhost:3000", "http://127.0.0.1:3000"]),
        ("http://localhost:3000, http://127.0.0.1:3000", ["http://localhost:3000", "http://127.0.0.1:3000"]),
        ("", []),
    ],
)
def test_cors_allow_origins_parses_string_inputs(raw_value, expected):
    settings = Settings(
        DB_USER="appuser",
        DB_PASSWORD="app pass",
        DB_HOST="localhost",
        DB_PORT=5432,
        DB_NAME="appdb",
        JWT_SECRET_KEY="secret",
        ACCESS_TOKEN_EXPIRE_MINUTES=60,
        REFRESH_TOKEN_EXPIRE_DAYS=7,
        ALGORITHM="HS256",
        CORS_ALLOW_ORIGINS=raw_value,
    )

    assert settings.CORS_ALLOW_ORIGINS == expected


def test_async_database_url_escapes_password_characters():
    settings = Settings(
        DB_USER="appuser",
        DB_PASSWORD="pass word/+",
        DB_HOST="localhost",
        DB_PORT=5432,
        DB_NAME="appdb",
        JWT_SECRET_KEY="secret",
        ACCESS_TOKEN_EXPIRE_MINUTES=60,
        REFRESH_TOKEN_EXPIRE_DAYS=7,
        ALGORITHM="HS256",
    )

    assert settings.ASYNC_DATABASE_URL == "postgresql+asyncpg://appuser:pass+word%2F%2B@localhost:5432/appdb"
