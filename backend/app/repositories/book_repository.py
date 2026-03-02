from typing import Optional
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book import Book


class BookRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_book(self, **book_data) -> Book:
        book = Book(**book_data)
        self.db.add(book)
        await self.db.commit()
        await self.db.refresh(book)
        return book

    async def list_books(self, offset: int, limit: int) -> list[Book]:
        result = await self.db.execute(
            select(Book)
            .order_by(Book.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count_books(self) -> int:
        count = await self.db.scalar(select(func.count()).select_from(Book))
        return int(count or 0)

    async def list_all_books(self) -> list[Book]:
        result = await self.db.execute(select(Book).order_by(Book.created_at.desc()))
        return list(result.scalars().all())

    async def get_book_by_id(self, book_id: UUID) -> Optional[Book]:
        return await self.db.scalar(select(Book).where(Book.id == book_id))

    async def save(self, book: Book) -> Book:
        self.db.add(book)
        await self.db.commit()
        await self.db.refresh(book)
        return book

    async def delete(self, book: Book) -> None:
        await self.db.delete(book)
        await self.db.commit()
