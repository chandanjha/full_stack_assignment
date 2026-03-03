from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from app.repositories.book_borrow_repository import BookBorrowRepository


def build_repo():
    db = SimpleNamespace(
        add=Mock(),
        commit=AsyncMock(),
        refresh=AsyncMock(),
        scalar=AsyncMock(),
        execute=AsyncMock(),
    )
    return BookBorrowRepository(db), db


async def test_create_book_borrow_persists_new_record():
    repo, db = build_repo()
    user_id = uuid4()
    book_id = uuid4()

    created = await repo.create_book_borrow(user_id, book_id)

    db.add.assert_called_once_with(created)
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(created)
    assert created.user_id == user_id
    assert created.book_id == book_id
    assert created.returned_at is None


async def test_has_any_book_borrow_returns_true_when_record_exists():
    repo, db = build_repo()
    db.scalar.return_value = object()

    result = await repo.has_any_book_borrow(uuid4(), uuid4())

    assert result is True
    db.scalar.assert_awaited_once()


async def test_list_user_book_borrows_returns_scalars_collection():
    repo, db = build_repo()
    first = object()
    second = object()
    scalar_result = Mock()
    scalar_result.all.return_value = [first, second]
    query_result = Mock()
    query_result.scalars.return_value = scalar_result
    db.execute.return_value = query_result

    result = await repo.list_user_book_borrows(uuid4())

    assert result == [first, second]
    db.execute.assert_awaited_once()
    query_result.scalars.assert_called_once()
    scalar_result.all.assert_called_once()


async def test_return_book_borrow_sets_timestamp_and_saves():
    repo, db = build_repo()
    book_borrow = SimpleNamespace(returned_at=None)

    returned = await repo.return_book_borrow(book_borrow)

    assert returned is book_borrow
    assert isinstance(book_borrow.returned_at, datetime)
    db.add.assert_called_once_with(book_borrow)
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(book_borrow)
