from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.review import Review


class ReviewRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_review(self, user_id: UUID, book_id: UUID, rating: int, comment: str | None) -> Review:
        review = Review(
            user_id=user_id,
            book_id=book_id,
            rating=rating,
            comment=comment,
        )
        self.db.add(review)
        await self.db.commit()
        await self.db.refresh(review)
        return review

    async def get_user_review(self, user_id: UUID, book_id: UUID) -> Optional[Review]:
        return await self.db.scalar(
            select(Review).where(
                Review.user_id == user_id,
                Review.book_id == book_id,
            )
        )

    async def list_book_reviews(self, book_id: UUID) -> list[Review]:
        result = await self.db.execute(
            select(Review)
            .where(Review.book_id == book_id)
            .order_by(Review.created_at.desc())
        )
        return list(result.scalars().all())

    async def list_user_reviews(self, user_id: UUID) -> list[Review]:
        result = await self.db.execute(
            select(Review)
            .where(Review.user_id == user_id)
            .order_by(Review.created_at.desc())
        )
        return list(result.scalars().all())
