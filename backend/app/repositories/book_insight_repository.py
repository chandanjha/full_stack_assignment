from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.book_insight import BookInsight


class BookInsightRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_book_id(self, book_id: UUID) -> BookInsight | None:
        return await self.db.scalar(select(BookInsight).where(BookInsight.book_id == book_id))

    async def upsert_consensus(self, book_id: UUID, reader_consensus: str) -> BookInsight:
        insight = await self.get_by_book_id(book_id)
        if insight is None:
            insight = BookInsight(book_id=book_id, reader_consensus=reader_consensus)
        else:
            insight.reader_consensus = reader_consensus

        self.db.add(insight)
        await self.db.commit()
        await self.db.refresh(insight)
        return insight
