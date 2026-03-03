from datetime import datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from app.constants import BookSummaryStatus
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


def build_service(profile_provider=None):
    return RecommendationService(
        db=SimpleNamespace(),
        recommendation_profile_provider=profile_provider or Mock(),
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


async def test_recommend_books_excludes_read_items_and_keeps_fallbacks():
    user = SimpleNamespace(id=uuid4())
    preferred = SimpleNamespace(
        preferred_tags=["science"],
        preferred_authors=["Author Match"],
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
    service = build_service()
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
    assert result[0].score == 8
    assert "matches tags: science" in result[0].reasons
    assert "includes favored author Author Match" in result[0].reasons
    assert "has generated summary metadata" in result[0].reasons
    assert result[1].score == 1
    assert result[1].reasons == ["unread title available for exploration"]
