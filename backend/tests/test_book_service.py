from contextlib import nullcontext
from datetime import datetime
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from fastapi import HTTPException, UploadFile

from app.constants import BookSummaryStatus
from app.providers.storage import StoredFile
from app.schemas.book import BookCreate
from app.services.book_service import BookService


def make_book(**overrides):
    now = datetime.utcnow()
    values = {
        "id": uuid4(),
        "title": "The Testing Book",
        "author": "A. Reader",
        "tags": ["testing"],
        "file_path": "books/testing.txt",
        "original_file_name": "testing.txt",
        "mime_type": "text/plain",
        "file_size": 128,
        "summary": None,
        "summary_error": None,
        "summary_status": BookSummaryStatus.PENDING.value,
        "created_at": now,
        "updated_at": now,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def build_service(storage=None, summary_provider=None):
    return BookService(
        db=SimpleNamespace(),
        storage=storage or Mock(),
        summary_provider=summary_provider or Mock(),
    )


async def test_create_book_deletes_stored_file_when_repository_save_fails():
    storage = Mock()
    storage.save_book_file.return_value = StoredFile(
        path="stored/testing.txt",
        original_file_name="testing.txt",
        mime_type="text/plain",
        file_size=3,
    )
    service = build_service(storage=storage)
    service.book_repo = SimpleNamespace(
        create_book=AsyncMock(side_effect=RuntimeError("database write failed")),
    )

    upload = UploadFile(file=BytesIO(b"abc"), filename="testing.txt", size=3)
    user = SimpleNamespace(id=uuid4())

    with pytest.raises(RuntimeError, match="database write failed"):
        await service.create_book(BookCreate(title="Testing"), upload, user)

    storage.delete_book_file.assert_called_once_with("stored/testing.txt")


async def test_borrow_book_returns_book_borrow_payload_when_available():
    book = make_book()
    user = SimpleNamespace(id=uuid4())
    borrowed_at = datetime.utcnow()
    created_book_borrow = SimpleNamespace(
        id=uuid4(),
        user_id=user.id,
        book_id=book.id,
        borrowed_at=borrowed_at,
        returned_at=None,
    )
    service = build_service()
    service.book_repo = SimpleNamespace(get_book_by_id=AsyncMock(return_value=book))
    service.book_borrow_repo = SimpleNamespace(
        get_active_book_borrow=AsyncMock(return_value=None),
        create_book_borrow=AsyncMock(return_value=created_book_borrow),
    )

    result = await service.borrow_book(book.id, user)

    assert result.user_id == str(user.id)
    assert result.book_id == str(book.id)
    assert result.borrowed_at == borrowed_at
    service.book_borrow_repo.create_book_borrow.assert_awaited_once_with(user.id, book.id)


async def test_return_book_raises_when_user_has_no_active_borrow():
    book = make_book()
    service = build_service()
    service.book_repo = SimpleNamespace(get_book_by_id=AsyncMock(return_value=book))
    service.book_borrow_repo = SimpleNamespace(
        get_active_book_borrow=AsyncMock(return_value=None),
    )

    with pytest.raises(HTTPException) as exc_info:
        await service.return_book(book.id, SimpleNamespace(id=uuid4()))

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "This book is not currently borrowed by you"


async def test_generate_summary_from_llm_updates_book_on_success():
    book = make_book()
    storage = Mock()
    storage.open_book_file.return_value = nullcontext(BytesIO(b"book content"))
    summary_provider = Mock()
    summary_provider.generate_summary.return_value = "Short generated summary"
    service = build_service(storage=storage, summary_provider=summary_provider)
    service.book_repo = SimpleNamespace(
        get_book_by_id=AsyncMock(return_value=book),
        save=AsyncMock(side_effect=lambda saved_book: saved_book),
    )

    await service.generate_summary_from_llm(book.id)

    assert book.summary == "Short generated summary"
    assert book.summary_error is None
    assert book.summary_status == BookSummaryStatus.COMPLETED.value
    assert service.book_repo.save.await_count == 2


async def test_generate_summary_from_llm_marks_book_failed_when_provider_errors():
    book = make_book()
    storage = Mock()
    storage.open_book_file.return_value = nullcontext(BytesIO(b"book content"))
    summary_provider = Mock()
    summary_provider.generate_summary.side_effect = RuntimeError("provider offline")
    service = build_service(storage=storage, summary_provider=summary_provider)
    service.book_repo = SimpleNamespace(
        get_book_by_id=AsyncMock(return_value=book),
        save=AsyncMock(side_effect=lambda saved_book: saved_book),
    )

    await service.generate_summary_from_llm(book.id)

    assert book.summary is None
    assert book.summary_status == BookSummaryStatus.FAILED.value
    assert book.summary_error == "Summary generation failed: provider offline"
    assert service.book_repo.save.await_count == 2
