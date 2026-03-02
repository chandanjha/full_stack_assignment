from pathlib import Path
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from app.constants import BookSummaryStatus

MAX_BOOK_FILE_SIZE_BYTES = 10 * 1024 * 1024


class BookCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    author: Optional[str] = Field(default=None, max_length=255)
    tags: list[str] = Field(default_factory=list)
    

class BookUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    author: Optional[str] = Field(default=None, max_length=255)
    tags: Optional[list[str]] = None


class BookPublic(BaseModel):
    id: str
    title: str
    author: Optional[str] = None
    tags: list[str]
    original_file_name: str
    mime_type: Optional[str] = None
    file_size: int
    summary: Optional[str] = None
    summary_error: Optional[str] = None
    summary_status: BookSummaryStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_book(cls, book):
        return cls(
            id=str(book.id),
            title=book.title,
            author=book.author,
            tags=list(book.tags or []),
            original_file_name=book.original_file_name,
            mime_type=book.mime_type,
            file_size=book.file_size,
            summary=book.summary,
            summary_error=book.summary_error,
            summary_status=BookSummaryStatus(book.summary_status),
            created_at=book.created_at,
            updated_at=book.updated_at,
        )


def validate_book_upload_file(upload_file: UploadFile) -> None:
    if not upload_file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A book file is required",
        )

    extension = Path(upload_file.filename).suffix.lower()
    if extension not in {".txt", ".pdf"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .txt and .pdf files are supported",
        )

    file_size = getattr(upload_file, "size", None)
    if not isinstance(file_size, int):
        try:
            upload_file.file.seek(0, 2)
            file_size = upload_file.file.tell()
            upload_file.file.seek(0)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not determine uploaded file size",
            ) from exc

    if file_size > MAX_BOOK_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Book file size must not exceed 10 MB",
        )
