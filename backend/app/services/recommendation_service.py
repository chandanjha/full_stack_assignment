from collections import Counter
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import BookSummaryStatus
from app.models.user import User
from app.providers import LocalRecommendationProfileProvider, RecommendationProfileProvider
from app.repositories.book_repository import BookRepository
from app.repositories.loan_repository import LoanRepository
from app.repositories.review_repository import ReviewRepository
from app.repositories.user_preference_repository import UserPreferenceRepository
from app.schemas.book import BookPublic
from app.schemas.library import RecommendationPublic, UserPreferencePublic


class RecommendationService:
    def __init__(
        self,
        db: AsyncSession,
        recommendation_profile_provider: RecommendationProfileProvider | None = None,
    ):
        self.db = db
        self.book_repo = BookRepository(db)
        self.loan_repo = LoanRepository(db)
        self.review_repo = ReviewRepository(db)
        self.user_preference_repo = UserPreferenceRepository(db)
        self.recommendation_profile_provider = (
            recommendation_profile_provider or LocalRecommendationProfileProvider()
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
        preference_summary = self.recommendation_profile_provider.summarize_preferences(
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
        generated_preference = await self.update_user_preferences(current_user.id)
        preferred_tags = generated_preference.preferred_tags
        preferred_authors = generated_preference.preferred_authors

        all_books = await self.book_repo.list_all_books()
        borrowed_book_ids = {loan.book_id for loan in await self.loan_repo.list_user_loans(current_user.id)}
        reviewed_book_ids = {review.book_id for review in await self.review_repo.list_user_reviews(current_user.id)}
        excluded_ids = borrowed_book_ids | reviewed_book_ids

        recommendations: list[RecommendationPublic] = []
        fallback_recommendations: list[RecommendationPublic] = []
        for book in all_books:
            if book.id in excluded_ids:
                continue

            score = 0
            reasons: list[str] = []

            matching_tags = [tag for tag in (book.tags or []) if tag in preferred_tags]
            if matching_tags:
                score += len(matching_tags) * 3
                reasons.append(f"matches tags: {', '.join(matching_tags[:3])}")

            if book.author and book.author in preferred_authors:
                score += 4
                reasons.append(f"includes favored author {book.author}")

            if (book.summary_status or "") == BookSummaryStatus.COMPLETED.value:
                score += 1
                reasons.append("has generated summary metadata")

            if score <= 0:
                fallback_recommendations.append(
                    RecommendationPublic(
                        book=BookPublic.from_orm_book(book),
                        score=1,
                        reasons=["unread title available for exploration"],
                    )
                )
                continue

            recommendations.append(
                RecommendationPublic(
                    book=BookPublic.from_orm_book(book),
                    score=score,
                    reasons=reasons,
                )
            )

        recommendations.extend(fallback_recommendations)
        recommendations.sort(key=lambda item: item.score, reverse=True)
        return recommendations[: max(limit, 1)]

    async def _get_user_borrowed_books(self, user_id: UUID):
        loans = await self.loan_repo.list_user_loans(user_id)
        books = []
        seen_ids: set[UUID] = set()
        for loan in loans:
            if loan.book_id in seen_ids:
                continue
            seen_ids.add(loan.book_id)
            book = await self.book_repo.get_book_by_id(loan.book_id)
            if book:
                books.append(book)
        return books
