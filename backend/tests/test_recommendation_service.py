from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from app.constants import BookSummaryStatus
from app.schemas.book import BookDetail
from app.schemas.library import RecommendationPublic
from app.services.recommendation_service import RecommendationService


def make_book(**overrides):
    now = datetime.utcnow()
    values = {
        "id": uuid4(),
        "title": "Test Title",
        "author": "Author",
        "tags": [],
        "original_file_name": "title.txt",
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


def build_cache_repo():
    return SimpleNamespace(
        get_user_recommendations=AsyncMock(return_value=None),
        set_user_recommendations=AsyncMock(),
        invalidate_user_recommendations=AsyncMock(),
    )


def build_service(profile_provider=None, ranking_provider=None, cache_repo=None):
    return RecommendationService(
        db=SimpleNamespace(),
        recommendation_profile_provider=profile_provider or Mock(),
        recommendation_ranking_provider=ranking_provider or Mock(),
        recommendation_cache_repo=cache_repo or build_cache_repo(),
    )


async def test_update_user_preferences_aggregates_borrowing_and_reviews():
    user_id = uuid4()
    borrowed_books = [
        make_book(tags=["sci-fi"], author="Author A"),
        make_book(tags=["sci-fi"], author="Author C"),
    ]
    review = SimpleNamespace(book_id=uuid4(), rating=5, comment="Loved it")
    reviewed_book = make_book(id=review.book_id, tags=["history"], author="Author B")
    stored_preference = SimpleNamespace(
        user_id=user_id,
        preferred_tags=["history", "sci-fi"],
        preferred_authors=["Author B", "Author A", "Author C"],
        preference_summary="Reader prefers history and science fiction.",
        updated_at=datetime.utcnow(),
    )
    profile_provider = Mock()
    profile_provider.summarize_preferences.return_value = stored_preference.preference_summary
    service = build_service(profile_provider=profile_provider)
    service._get_user_borrowed_books = AsyncMock(return_value=borrowed_books)
    service.review_repo = SimpleNamespace(list_user_reviews=AsyncMock(return_value=[review]))
    service.book_repo = SimpleNamespace(get_book_by_id=AsyncMock(return_value=reviewed_book))
    service.user_preference_repo = SimpleNamespace(
        upsert=AsyncMock(return_value=stored_preference),
    )

    result = await service.update_user_preferences(user_id)

    service.user_preference_repo.upsert.assert_awaited_once_with(
        user_id=user_id,
        preferred_tags=["history", "sci-fi"],
        preferred_authors=["Author B", "Author A", "Author C"],
        preference_summary="Reader prefers history and science fiction.",
    )
    assert result.preferred_tags == ["history", "sci-fi"]
    assert result.preferred_authors == ["Author B", "Author A", "Author C"]


async def test_recommend_books_returns_cached_recommendations_when_available():
    user = SimpleNamespace(id=uuid4())
    cached_book = make_book(title="Cached Pick")
    cached_recommendation = RecommendationPublic(
        book=BookDetail.from_orm_book(cached_book),
        score=99,
        reasons=["served from redis cache"],
    )
    cache_repo = build_cache_repo()
    cache_repo.get_user_recommendations = AsyncMock(return_value=[cached_recommendation])
    service = build_service(cache_repo=cache_repo)
    service.update_user_preferences = AsyncMock(side_effect=AssertionError("Should not compute on cache hit"))

    result = await service.recommend_books(user, limit=3)

    assert result == [cached_recommendation]
    cache_repo.get_user_recommendations.assert_awaited_once_with(user.id, 3)
    cache_repo.set_user_recommendations.assert_not_awaited()


async def test_recommend_books_excludes_read_items_and_keeps_fallbacks():
    user = SimpleNamespace(id=uuid4())
    preferred = SimpleNamespace(
        preferred_tags=["science"],
        preferred_authors=["Author Match"],
        preference_summary="Enjoys science books from Author Match.",
    )
    borrowed_book = make_book(
        id=uuid4(),
        title="Already Borrowed",
        author="Author Match",
        tags=["science"],
        summary_status=BookSummaryStatus.COMPLETED.value,
    )
    ranked_book = make_book(
        id=uuid4(),
        title="Top Pick",
        author="Author Match",
        tags=["science"],
        summary_status=BookSummaryStatus.COMPLETED.value,
    )
    fallback_book = make_book(
        id=uuid4(),
        title="Wildcard",
        author="Different Author",
        tags=["poetry"],
        summary_status=BookSummaryStatus.PENDING.value,
    )
    ranking_provider = Mock()
    ranking_provider.rank_books.return_value = [
        {
            "book_id": str(ranked_book.id),
            "score": 96,
            "reasons": ["aligns with science content", "matches preferred author Author Match"],
        },
        {
            "book_id": str(fallback_book.id),
            "score": 28,
            "reasons": ["broader adjacent catalog fit"],
        },
    ]
    cache_repo = build_cache_repo()
    service = build_service(ranking_provider=ranking_provider, cache_repo=cache_repo)
    service.update_user_preferences = AsyncMock(return_value=preferred)
    service.book_repo = SimpleNamespace(
        list_all_books=AsyncMock(return_value=[borrowed_book, ranked_book, fallback_book]),
    )
    service.book_borrow_repo = SimpleNamespace(
        list_user_book_borrows=AsyncMock(return_value=[SimpleNamespace(book_id=borrowed_book.id)]),
    )
    service.review_repo = SimpleNamespace(list_user_reviews=AsyncMock(return_value=[]))

    result = await service.recommend_books(user, limit=5)

    assert [item.book.id for item in result] == [str(ranked_book.id), str(fallback_book.id)]
    assert result[0].score == 96
    assert result[0].reasons == [
        "aligns with science content",
        "matches preferred author Author Match",
    ]
    assert result[1].score == 28
    assert result[1].reasons == ["broader adjacent catalog fit"]

    ranking_provider.rank_books.assert_called_once()
    ranking_call = ranking_provider.rank_books.call_args.kwargs
    assert ranking_call["favorite_tags"] == ["science"]
    assert ranking_call["favorite_authors"] == ["Author Match"]
    assert ranking_call["preference_summary"] == "Enjoys science books from Author Match."
    assert ranking_call["limit"] == 5
    assert [book["title"] for book in ranking_call["candidate_books"]] == ["Top Pick", "Wildcard"]
    cache_repo.set_user_recommendations.assert_awaited_once()
    cache_args = cache_repo.set_user_recommendations.call_args.args
    assert cache_args[0] == user.id
    assert cache_args[1] == 5
    assert [item.book.id for item in cache_args[2]] == [str(ranked_book.id), str(fallback_book.id)]


async def test_refresh_recommendation_cache_invalidates_and_warms_cache():
    user_id = uuid4()
    preferred = SimpleNamespace(
        preferred_tags=["science"],
        preferred_authors=["Author Match"],
        preference_summary="Enjoys science books from Author Match.",
    )
    ranked_book = make_book(
        id=uuid4(),
        title="Fresh Pick",
        author="Author Match",
        tags=["science"],
        summary_status=BookSummaryStatus.COMPLETED.value,
    )
    ranking_provider = Mock()
    ranking_provider.rank_books.return_value = [
        {
            "book_id": str(ranked_book.id),
            "score": 90,
            "reasons": ["freshly recomputed profile match"],
        }
    ]
    cache_repo = build_cache_repo()
    service = build_service(ranking_provider=ranking_provider, cache_repo=cache_repo)
    service.update_user_preferences = AsyncMock(return_value=preferred)
    service.book_repo = SimpleNamespace(
        list_all_books=AsyncMock(return_value=[ranked_book]),
    )
    service.book_borrow_repo = SimpleNamespace(
        list_user_book_borrows=AsyncMock(return_value=[]),
    )
    service.review_repo = SimpleNamespace(list_user_reviews=AsyncMock(return_value=[]))

    result = await service.refresh_recommendation_cache(user_id, limit=4)

    assert [item.book.id for item in result] == [str(ranked_book.id)]
    cache_repo.invalidate_user_recommendations.assert_awaited_once_with(user_id)
    cache_repo.set_user_recommendations.assert_awaited_once_with(user_id, 4, result)
