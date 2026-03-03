from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.book import BookDetail


class BookBorrowPublic(BaseModel):
    id: str
    user_id: str
    book_id: str
    borrowed_at: datetime
    returned_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_book_borrow(cls, book_borrow):
        return cls(
            id=str(book_borrow.id),
            user_id=str(book_borrow.user_id),
            book_id=str(book_borrow.book_id),
            borrowed_at=book_borrow.borrowed_at,
            returned_at=book_borrow.returned_at,
        )


class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=5000)


class ReviewPublic(BaseModel):
    id: str
    user_id: str
    book_id: str
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_review(cls, review):
        return cls(
            id=str(review.id),
            user_id=str(review.user_id),
            book_id=str(review.book_id),
            rating=review.rating,
            comment=review.comment,
            created_at=review.created_at,
        )


class BookInsightPublic(BaseModel):
    book_id: str
    reader_consensus: Optional[str] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def from_orm_insight(cls, insight):
        return cls(
            book_id=str(insight.book_id),
            reader_consensus=insight.reader_consensus,
            updated_at=insight.updated_at,
        )


class UserPreferencePublic(BaseModel):
    user_id: str
    preferred_tags: list[str]
    preferred_authors: list[str]
    preference_summary: Optional[str] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def from_orm_preference(cls, preference):
        return cls(
            user_id=str(preference.user_id),
            preferred_tags=list(preference.preferred_tags or []),
            preferred_authors=list(preference.preferred_authors or []),
            preference_summary=preference.preference_summary,
            updated_at=preference.updated_at,
        )


class RecommendationPublic(BaseModel):
    book: BookDetail
    score: int
    reasons: list[str]
