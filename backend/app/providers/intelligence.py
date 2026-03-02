from typing import BinaryIO, Protocol

from pypdf import PdfReader

from app.core.settings import settings
from app.services.llm_service import LLMService


def _build_llm_service() -> LLMService:
    return LLMService(
        provider=settings.LLM_PROVIDER,
        base_url=settings.LLM_BASE_URL,
        model=settings.LLM_MODEL,
        timeout_seconds=settings.LLM_TIMEOUT_SECONDS,
        grok_base_url=settings.GROK_BASE_URL,
        grok_api_key=settings.GROK_API_KEY,
        gpt_base_url=settings.GPT_BASE_URL,
        gpt_api_key=settings.GPT_API_KEY,
    )


class BookSummaryProvider(Protocol):
    def generate_summary(
        self,
        file_stream: BinaryIO,
        file_name: str,
        mime_type: str | None,
        title: str,
        author: str | None,
    ) -> str:
        ...


class LocalBookSummaryProvider:
    def __init__(self, llm_service: LLMService | None = None):
        self.llm_service = llm_service or _build_llm_service()

    def generate_summary(
        self,
        file_stream: BinaryIO,
        file_name: str,
        mime_type: str | None,
        title: str,
        author: str | None,
    ) -> str:
        extracted_text = self._extract_text(file_stream, file_name, mime_type)
        if not extracted_text:
            return "Book uploaded successfully, but no readable text content was found."

        normalized = " ".join(extracted_text.split())
        prompt_source = normalized[:2000]

        if not settings.LLM_ENABLED:
            raise RuntimeError("LLM summary generation is disabled")

        return self.llm_service.summarize_book(prompt_source, title=title, author=author)

    def _extract_text(self, file_stream: BinaryIO, file_name: str, mime_type: str | None) -> str:
        if mime_type == "application/pdf" or file_name.lower().endswith(".pdf"):
            return self._extract_pdf_text(file_stream)

        try:
            self._rewind_stream(file_stream)
            return file_stream.read(4096).decode("utf-8", errors="ignore").strip()
        except Exception:
            return ""

    def _extract_pdf_text(self, file_stream: BinaryIO) -> str:
        try:
            self._rewind_stream(file_stream)
            reader = PdfReader(file_stream)
            pages = [page.extract_text() or "" for page in reader.pages]
            return "\n".join(pages).strip()
        except Exception:
            return ""

    def _rewind_stream(self, file_stream: BinaryIO) -> None:
        if hasattr(file_stream, "seek"):
            file_stream.seek(0)


class ReviewConsensusProvider(Protocol):
    def summarize_reviews(self, title: str, reviews: list) -> str:
        ...


class LocalReviewConsensusProvider:
    def __init__(self, llm_service: LLMService | None = None):
        self.llm_service = llm_service or _build_llm_service()

    def summarize_reviews(self, title: str, reviews: list) -> str:
        if not reviews:
            return "No reader reviews yet."

        average = sum(review.rating for review in reviews) / len(reviews)
        positives = sum(1 for review in reviews if review.rating >= 4)
        negatives = sum(1 for review in reviews if review.rating <= 2)

        if settings.LLM_ENABLED:
            review_lines = []
            for review in reviews[:8]:
                comment = (review.comment or "No written comment").strip()
                review_lines.append(f"Rating {review.rating}/5: {comment[:280]}")
            review_context = "\n".join(review_lines)
            try:
                return self.llm_service.summarize_reviews(
                    reviews_text=review_context,
                    title=title,
                    average_rating=average,
                    review_count=len(reviews),
                    positive_count=positives,
                    critical_count=negatives,
                )
            except Exception:
                pass

        return self._fallback_summary(reviews, average, positives, negatives)

    def _fallback_summary(
        self,
        reviews: list,
        average: float,
        positives: int,
        negatives: int,
    ) -> str:
        if not reviews:
            return "No reader reviews yet."

        comments = [review.comment.strip() for review in reviews if review.comment]
        themes = ", ".join(comments[:2])[:180].strip() or "consistent reader feedback is still emerging"
        pros = (
            "strong positive sentiment"
            if positives >= negatives
            else "some readers still found redeeming qualities"
        )
        cons = (
            "limited critical feedback"
            if negatives == 0
            else "some readers reported concerns or weaker engagement"
        )

        return (
            f"Sentiment Summary: Readers lean {'positive' if positives >= negatives else 'mixed'} overall.\n"
            f"Themes: {themes}\n"
            f"Pros: {pros}\n"
            f"Cons: {cons}\n"
            f"Average Rating Context: {average:.1f}/5 across {len(reviews)} review(s), "
            f"with {positives} positive and {negatives} critical review(s)."
        )


class RecommendationProfileProvider(Protocol):
    def summarize_preferences(
        self,
        favorite_tags: list[str],
        favorite_authors: list[str],
        reviews: list,
    ) -> str:
        ...


class LocalRecommendationProfileProvider:
    def __init__(self, llm_service: LLMService | None = None):
        self.llm_service = llm_service or _build_llm_service()

    def summarize_preferences(
        self,
        favorite_tags: list[str],
        favorite_authors: list[str],
        reviews: list,
    ) -> str:
        review_signals = [
            f"{review.rating}/5 on book {review.book_id}: {(review.comment or 'No comment')[:120]}"
            for review in reviews[:5]
        ]
        context = (
            f"Favorite tags: {', '.join(favorite_tags) or 'none'}\n"
            f"Favorite authors: {', '.join(favorite_authors) or 'none'}\n"
            f"Recent review signals: {' | '.join(review_signals) or 'none'}"
        )

        if settings.LLM_ENABLED:
            try:
                return self.llm_service.summarize_preferences(context)
            except Exception:
                pass

        if favorite_tags or favorite_authors:
            return (
                f"Leans toward tags [{', '.join(favorite_tags) or 'none'}] "
                f"and authors [{', '.join(favorite_authors) or 'none'}]."
            )
        return "Not enough reading history yet to identify stable preferences."
