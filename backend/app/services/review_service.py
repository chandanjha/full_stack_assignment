from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.providers import LocalReviewConsensusProvider, ReviewConsensusProvider
from app.repositories.book_insight_repository import BookInsightRepository
from app.repositories.book_borrow_repository import BookBorrowRepository
from app.repositories.book_repository import BookRepository
from app.repositories.review_repository import ReviewRepository
from app.schemas.library import BookInsightPublic, ReviewCreate, ReviewPublic


class ReviewService:
    def __init__(
        self,
        db: AsyncSession,
        review_consensus_provider: ReviewConsensusProvider | None = None,
    ):
        self.db = db
        self.book_repo = BookRepository(db)
        self.book_borrow_repo = BookBorrowRepository(db)
        self.review_repo = ReviewRepository(db)
        self.book_insight_repo = BookInsightRepository(db)
        self.review_consensus_provider = review_consensus_provider or LocalReviewConsensusProvider()

    async def create_review(self, book_id: UUID, payload: ReviewCreate, current_user: User) -> ReviewPublic:
        await self._get_book_or_404(book_id)
        if not await self.book_borrow_repo.has_any_book_borrow(current_user.id, book_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only review books you have borrowed",
            )

        existing_review = await self.review_repo.get_user_review(current_user.id, book_id)
        if existing_review:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You have already reviewed this book",
            )

        review = await self.review_repo.create_review(
            user_id=current_user.id,
            book_id=book_id,
            rating=payload.rating,
            comment=payload.comment,
        )
        return ReviewPublic.from_orm_review(review)

    async def list_reviews(self, book_id: UUID) -> list[ReviewPublic]:
        await self._get_book_or_404(book_id)
        reviews = await self.review_repo.list_book_reviews(book_id)
        return [ReviewPublic.from_orm_review(review) for review in reviews]

    async def update_review_consensus(self, book_id: UUID) -> None:
        book = await self._get_book_or_404(book_id)
        reviews = await self.review_repo.list_book_reviews(book_id)
        consensus = self.review_consensus_provider.summarize_reviews(book.title, reviews)
        await self.book_insight_repo.upsert_consensus(book_id, consensus)

    async def get_book_insight(self, book_id: UUID) -> BookInsightPublic:
        await self._get_book_or_404(book_id)
        insight = await self.book_insight_repo.get_by_book_id(book_id)
        if insight is None:
            return BookInsightPublic(
                book_id=str(book_id),
                reader_consensus="No reader reviews yet.",
                updated_at=None,
            )
        return BookInsightPublic.from_orm_insight(insight)

    async def _get_book_or_404(self, book_id: UUID):
        book = await self.book_repo.get_book_by_id(book_id)
        if not book:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Book not found",
            )
        return book
