import json
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings
from urllib.parse import quote_plus


class Settings(BaseSettings):
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str
    DB_PORT: int
    DB_NAME: str

    @property
    def DATABASE_URL(self) -> str:
        password = quote_plus(self.DB_PASSWORD)
        return (
            f"postgresql+psycopg2://{self.DB_USER}:"
            f"{password}@"
            f"{self.DB_HOST}:"
            f"{self.DB_PORT}/"
            f"{self.DB_NAME}"
        )

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        password = quote_plus(self.DB_PASSWORD)
        return (
            f"postgresql+asyncpg://{self.DB_USER}:"
            f"{password}@"
            f"{self.DB_HOST}:"
            f"{self.DB_PORT}/"
            f"{self.DB_NAME}"
        )

    JWT_SECRET_KEY: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int
    ALGORITHM: str
    CORS_ALLOW_ORIGINS: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        ]
    )

    STORAGE_PROVIDER: str = "local"
    BOOK_STORAGE_DIR: str = "storage/books"
    S3_BUCKET_NAME: str = ""
    S3_REGION: str = "us-east-1"
    S3_ENDPOINT_URL: str | None = None
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""

    LLM_ENABLED: bool = True
    LLM_PROVIDER: str = "ollama"
    LLM_BASE_URL: str = "http://ollama:11434"
    LLM_MODEL: str = "llama3"
    LLM_TIMEOUT_SECONDS: int = 60
    GROK_BASE_URL: str = "https://api.x.ai/v1"
    GROK_API_KEY: str = ""
    GPT_BASE_URL: str = "https://api.openai.com/v1"
    GPT_API_KEY: str = ""

    @field_validator("CORS_ALLOW_ORIGINS", mode="before")
    @classmethod
    def parse_cors_allow_origins(cls, value: Any) -> Any:
        if isinstance(value, str):
            raw_value = value.strip()
            if not raw_value:
                return []
            if raw_value.startswith("["):
                parsed_value = json.loads(raw_value)
                if not isinstance(parsed_value, list):
                    raise ValueError("CORS_ALLOW_ORIGINS must be a JSON array")
                return [str(item).strip() for item in parsed_value if str(item).strip()]
            return [item.strip() for item in raw_value.split(",") if item.strip()]
        return value

    class Config:
        env_file = str(Path(__file__).resolve().parents[2] / ".env")
        env_file_encoding = "utf-8"
        extra = "forbid"


settings = Settings()
