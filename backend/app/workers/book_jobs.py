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
    try:
        book_uuid = UUID(book_id)
    except ValueError:
        logger.error(
            "generate_book_summary_job received invalid book_id=%s",
            book_id,
        )
        return

    async with SessionLocal() as db:
        try:
            service = BookService(db, storage=build_storage_provider())
            await service.generate_summary_from_llm(book_uuid)
        except Exception:
            logger.exception(
                "generate_book_summary_job failed for book_id=%s",
                book_id,
            )


async def update_book_review_consensus_job(book_id: str) -> None:
    """Rebuild reader consensus in an isolated DB session."""
    try:
        book_uuid = UUID(book_id)
    except ValueError:
        logger.error(
            "update_book_review_consensus_job received invalid book_id=%s",
            book_id,
        )
        return

    async with SessionLocal() as db:
        try:
            service = ReviewService(db)
            await service.update_review_consensus(book_uuid)
        except Exception:
            logger.exception(
                "update_book_review_consensus_job failed for book_id=%s",
                book_id,
            )


async def update_user_preferences_job(user_id: str) -> None:
    """Refresh recommendation preferences in an isolated DB session."""
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        logger.error(
            "update_user_preferences_job received invalid user_id=%s",
            user_id,
        )
        return

    async with SessionLocal() as db:
        try:
            service = RecommendationService(db)
            await service.update_user_preferences(user_uuid)
        except Exception:
            logger.exception(
                "update_user_preferences_job failed for user_id=%s",
                user_id,
            )