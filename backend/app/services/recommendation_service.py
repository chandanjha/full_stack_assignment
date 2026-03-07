import asyncio
from collections import Counter
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.providers import (
    LocalRecommendationProfileProvider,
    LocalRecommendationRankingProvider,
    RecommendationProfileProvider,
    RecommendationRankingProvider,
)
from app.repositories.book_borrow_repository import BookBorrowRepository
from app.repositories.book_repository import BookRepository
from app.repositories.review_repository import ReviewRepository
from app.repositories.user_preference_repository import UserPreferenceRepository
from app.schemas.book import BookDetail
from app.schemas.library import RecommendationPublic, UserPreferencePublic


class RecommendationService:
    def __init__(
        self,
        db: AsyncSession,
        recommendation_profile_provider: RecommendationProfileProvider | None = None,
        recommendation_ranking_provider: RecommendationRankingProvider | None = None,
    ):
        self.db = db
        self.book_repo = BookRepository(db)
        self.book_borrow_repo = BookBorrowRepository(db)
        self.review_repo = ReviewRepository(db)
        self.user_preference_repo = UserPreferenceRepository(db)
        self.recommendation_profile_provider = (
            recommendation_profile_provider or LocalRecommendationProfileProvider()
        )
        self.recommendation_ranking_provider = (
            recommendation_ranking_provider or LocalRecommendationRankingProvider()
        )

    async def update_user_preferences(self, user_id: UUID) -> UserPreferencePublic:
        borrowed_books = await self._get_user_borrowed_books(user_id)
        user_reviews = await self.review_repo.list_user_reviews(user_id)

        tag_scores: Counter[str] = Counter()
        author_scores: Counter[str] = Counter()

        for book in borrowed_books:
            for tag in book.tags or []:
                tag_scores[tag] += 1
            if book.author:
                author_scores[book.author] += 1

        for review in user_reviews:
            reviewed_book = await self.book_repo.get_book_by_id(review.book_id)
            if not reviewed_book:
                continue

            weight = max(review.rating - 2, 0)
            for tag in reviewed_book.tags or []:
                tag_scores[tag] += weight
            if reviewed_book.author:
                author_scores[reviewed_book.author] += weight

        top_tags = [tag for tag, _ in tag_scores.most_common(5)]
        top_authors = [author for author, _ in author_scores.most_common(5)]
        preference_summary = await asyncio.to_thread(
            self.recommendation_profile_provider.summarize_preferences,
            top_tags,
            top_authors,
            user_reviews,
        )
        preference = await self.user_preference_repo.upsert(
            user_id=user_id,
            preferred_tags=top_tags,
            preferred_authors=top_authors,
            preference_summary=preference_summary,
        )
        return UserPreferencePublic.from_orm_preference(preference)

    async def get_user_preferences(self, user_id: UUID) -> UserPreferencePublic:
        preference = await self.user_preference_repo.get_by_user_id(user_id)
        if preference is None:
            return await self.update_user_preferences(user_id)
        return UserPreferencePublic.from_orm_preference(preference)

    async def recommend_books(self, current_user: User, limit: int = 5) -> list[RecommendationPublic]:
        safe_limit = max(limit, 1)
        generated_preference = await self.update_user_preferences(current_user.id)
        preferred_tags = generated_preference.preferred_tags
        preferred_authors = generated_preference.preferred_authors
        preference_summary_for_ranking = (
            generated_preference.preference_summary if (preferred_tags or preferred_authors) else None
        )

        all_books = await self.book_repo.list_all_books()
        borrowed_book_ids = {
            book_borrow.book_id
            for book_borrow in await self.book_borrow_repo.list_user_book_borrows(current_user.id)
        }
        reviewed_book_ids = {review.book_id for review in await self.review_repo.list_user_reviews(current_user.id)}
        excluded_ids = borrowed_book_ids | reviewed_book_ids

        candidate_books = [
            {
                "id": str(book.id),
                "title": book.title,
                "author": book.author,
                "tags": list(book.tags or []),
                "summary": book.summary,
                "summary_status": book.summary_status,
            }
            for book in all_books
            if book.id not in excluded_ids
        ]
        ranked_candidates = await asyncio.to_thread(
            self.recommendation_ranking_provider.rank_books,
            favorite_tags=preferred_tags,
            favorite_authors=preferred_authors,
            preference_summary=preference_summary_for_ranking,
            candidate_books=candidate_books,
            limit=safe_limit,
        )
        books_by_id = {
            str(book.id): book
            for book in all_books
            if book.id not in excluded_ids
        }
        recommendations: list[RecommendationPublic] = []

        for ranked_candidate in ranked_candidates:
            book = books_by_id.get(str(ranked_candidate.get("book_id")))
            if book is None:
                continue

            raw_reasons = ranked_candidate.get("reasons") or []
            reasons = [str(reason) for reason in raw_reasons if str(reason).strip()]
            recommendations.append(
                RecommendationPublic(
                    book=BookDetail.from_orm_book(book),
                    score=int(ranked_candidate.get("score", 1)),
                    reasons=reasons or ["content-based match from reader profile"],
                )
            )

        return recommendations[:safe_limit]

    async def _get_user_borrowed_books(self, user_id: UUID):
        book_borrows = await self.book_borrow_repo.list_user_book_borrows(user_id)
        books = []
        seen_ids: set[UUID] = set()
        for book_borrow in book_borrows:
            if book_borrow.book_id in seen_ids:
                continue
            seen_ids.add(book_borrow.book_id)
            book = await self.book_repo.get_book_by_id(book_borrow.book_id)
            if book:
                books.append(book)
        return books
