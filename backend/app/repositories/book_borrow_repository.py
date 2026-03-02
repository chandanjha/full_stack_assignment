from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book_borrow import BookBorrow


class BookBorrowRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_book_borrow(self, user_id: UUID, book_id: UUID) -> BookBorrow:
        book_borrow = BookBorrow(user_id=user_id, book_id=book_id)
        self.db.add(book_borrow)
        await self.db.commit()
        await self.db.refresh(book_borrow)
        return book_borrow

    async def get_active_book_borrow(self, user_id: UUID, book_id: UUID) -> Optional[BookBorrow]:
        return await self.db.scalar(
            select(BookBorrow).where(
                BookBorrow.user_id == user_id,
                BookBorrow.book_id == book_id,
                BookBorrow.returned_at.is_(None),
            )
        )

    async def has_any_book_borrow(self, user_id: UUID, book_id: UUID) -> bool:
        existing = await self.db.scalar(
            select(BookBorrow).where(
                BookBorrow.user_id == user_id,
                BookBorrow.book_id == book_id,
            )
        )
        return existing is not None

    async def list_user_book_borrows(self, user_id: UUID) -> list[BookBorrow]:
        result = await self.db.execute(
            select(BookBorrow)
            .where(BookBorrow.user_id == user_id)
            .order_by(BookBorrow.borrowed_at.desc())
        )
        return list(result.scalars().all())

    async def return_book_borrow(self, book_borrow: BookBorrow) -> BookBorrow:
        book_borrow.returned_at = datetime.utcnow()
        self.db.add(book_borrow)
        await self.db.commit()
        await self.db.refresh(book_borrow)
        return book_borrow
