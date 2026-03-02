import logging
from uuid import UUID

from app.db.session import SessionLocal
from app.providers import build_storage_provider
from app.services.book_service import BookService
from app.services.recommendation_service import RecommendationService
from app.services.review_service import ReviewService

logger = logging.getLogger(__name__)


async def generate_book_summary_job(book_id: str) -> None:
    """Run LLM-based book summary generation in an isolated DB session."""
    async with SessionLocal() as db:
        try:
            await BookService(db, storage=build_storage_provider()).generate_summary_from_llm(UUID(book_id))
        except Exception:
            logger.exception("Error generating summary for book %s", book_id)


async def update_book_review_consensus_job(book_id: str) -> None:
    """Rebuild reader consensus in an isolated DB session."""
    async with SessionLocal() as db:
        try:
            await ReviewService(db).update_review_consensus(UUID(book_id))
        except Exception:
            logger.exception("Error updating review consensus for book %s", book_id)


async def update_user_preferences_job(user_id: str) -> None:
    """Refresh recommendation preferences in an isolated DB session."""
    async with SessionLocal() as db:
        try:
            await RecommendationService(db).update_user_preferences(UUID(user_id))
        except Exception:
            logger.exception("Error updating user preferences for user %s", user_id)
