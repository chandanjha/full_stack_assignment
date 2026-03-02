from contextlib import contextmanager
import shutil
from tempfile import SpooledTemporaryFile
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, ContextManager, Iterator, Protocol

from fastapi import UploadFile

from app.core.settings import settings


@dataclass
class StoredFile:
    path: str
    original_file_name: str
    mime_type: str | None
    file_size: int


class StorageProvider(Protocol):
    def save_book_file(self, upload_file: UploadFile) -> StoredFile:
        ...

    def delete_book_file(self, file_path: str) -> None:
        ...

    def open_book_file(self, file_path: str) -> ContextManager[BinaryIO]:
        ...


class LocalFileStorage:
    def __init__(self, base_dir: str):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def save_book_file(self, upload_file: UploadFile) -> StoredFile:
        suffix = Path(upload_file.filename or "").suffix
        stored_name = f"{uuid.uuid4()}{suffix}"
        destination = self.base_dir / stored_name

        with destination.open("wb") as buffer:
            shutil.copyfileobj(upload_file.file, buffer)
            file_size = buffer.tell()

        upload_file.file.close()

        return StoredFile(
            path=stored_name,
            original_file_name=upload_file.filename or stored_name,
            mime_type=upload_file.content_type,
            file_size=file_size,
        )

    def delete_book_file(self, file_path: str) -> None:
        absolute_path = self._resolve_path(file_path)
        if absolute_path.exists():
            absolute_path.unlink()

    def open_book_file(self, file_path: str) -> ContextManager[BinaryIO]:
        return self._resolve_path(file_path).open("rb")

    def _resolve_path(self, file_path: str) -> Path:
        return self.base_dir / file_path


class S3FileStorage:
    def __init__(
        self,
        bucket_name: str,
        region_name: str = "us-east-1",
        endpoint_url: str | None = None,
        access_key_id: str | None = None,
        secret_access_key: str | None = None,
    ):
        if not bucket_name:
            raise RuntimeError("S3_BUCKET_NAME is required when STORAGE_PROVIDER=s3")

        self.bucket_name = bucket_name
        self.region_name = region_name
        self.endpoint_url = endpoint_url or None
        self.access_key_id = access_key_id or None
        self.secret_access_key = secret_access_key or None
        self._client = None

    def save_book_file(self, upload_file: UploadFile) -> StoredFile:
        suffix = Path(upload_file.filename or "").suffix
        stored_name = f"{uuid.uuid4()}{suffix}"
        file_bytes = upload_file.file.read()
        upload_file.file.close()

        self._get_client().put_object(
            Bucket=self.bucket_name,
            Key=stored_name,
            Body=file_bytes,
            ContentType=upload_file.content_type or "application/octet-stream",
        )

        return StoredFile(
            path=stored_name,
            original_file_name=upload_file.filename or stored_name,
            mime_type=upload_file.content_type,
            file_size=len(file_bytes),
        )

    def delete_book_file(self, file_path: str) -> None:
        self._get_client().delete_object(Bucket=self.bucket_name, Key=file_path)

    @contextmanager
    def open_book_file(self, file_path: str) -> Iterator[BinaryIO]:
        temp_file = SpooledTemporaryFile(max_size=1024 * 1024, mode="w+b")
        try:
            self._get_client().download_fileobj(self.bucket_name, file_path, temp_file)
            temp_file.seek(0)
            yield temp_file
        finally:
            temp_file.close()

    def _get_client(self):
        if self._client is None:
            try:
                import boto3
            except ImportError as exc:
                raise RuntimeError("boto3 is required when STORAGE_PROVIDER=s3") from exc

            self._client = boto3.client(
                "s3",
                region_name=self.region_name,
                endpoint_url=self.endpoint_url,
                aws_access_key_id=self.access_key_id,
                aws_secret_access_key=self.secret_access_key,
            )
        return self._client


def build_storage_provider() -> StorageProvider:
    provider = settings.STORAGE_PROVIDER.lower()

    if provider == "local":
        return LocalFileStorage(settings.BOOK_STORAGE_DIR)

    if provider == "s3":
        return S3FileStorage(
            bucket_name=settings.S3_BUCKET_NAME,
            region_name=settings.S3_REGION,
            endpoint_url=settings.S3_ENDPOINT_URL,
            access_key_id=settings.S3_ACCESS_KEY_ID,
            secret_access_key=settings.S3_SECRET_ACCESS_KEY,
        )

    raise RuntimeError(
        f"Unsupported storage provider '{settings.STORAGE_PROVIDER}'. "
        "Use 'local' or 's3'."
    )
