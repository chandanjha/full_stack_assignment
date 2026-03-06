import json
import re
from typing import Any, BinaryIO, Protocol

from pypdf import PdfReader
from dataclasses import dataclass

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

def _safe_str(value: Any) -> str:
    return str(value).strip()

def _normalize_term(value: str) -> str:
    # Normalize tags/authors to make matching stable across case/whitespace.
    return value.strip().lower()

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
    
# -----------------------------
# Recommendation ranking
# -----------------------------

class RecommendationRankingProvider(Protocol):
    def rank_books(
        self,
        favorite_tags: list[str],
        favorite_authors: list[str],
        preference_summary: str | None,
        candidate_books: list[dict[str, Any]],
        limit: int,
    ) -> list[dict[str, Any]]:
        ...


@dataclass(frozen=True)
class RankingWeights:
    tag_weight: int = 15
    author_weight: int = 20
    theme_weight: int = 5
    summary_bonus: int = 4
    max_score: int = 100


class LocalRecommendationRankingProvider:
    """
    Recommendation strategy:

    1) Deterministic scoring engine (primary):
       - Tag alignment (strongest)
       - Author affinity
       - Thematic overlap (token-based)
       - Small bonus when a summary exists

    2) Optional LLM re-ranking (secondary):
       - Applied only to top-N pool
       - Used for semantic refinement
       - Never required for correctness

    Output is explainable ("reasons") and stable (fallback always available).
    """

    _STOP_WORDS = {
        "about", "after", "also", "and", "are", "book", "books", "for", "from",
        "have", "into", "more", "reader", "readers", "that", "the", "their",
        "them", "these", "this", "with", "your",
    }

    def __init__(self, llm_service: LLMService | None = None, weights: RankingWeights | None = None):
        self.llm_service = llm_service or _build_llm_service()
        self.weights = weights or RankingWeights()

    def rank_books(
        self,
        favorite_tags: list[str],
        favorite_authors: list[str],
        preference_summary: str | None,
        candidate_books: list[dict[str, Any]],
        limit: int,
    ) -> list[dict[str, Any]]:
        safe_limit = max(int(limit or 1), 1)
        if not candidate_books:
            return []

        # Normalize incoming signals for stable matching.
        favorite_tags_norm = [_normalize_term(t) for t in favorite_tags if str(t).strip()]
        favorite_authors_norm = [_normalize_term(a) for a in favorite_authors if str(a).strip()]
        preference_summary = (preference_summary or "").strip() or None

        fallback_rankings = self._rank_with_fallback(
            favorite_tags=favorite_tags_norm,
            favorite_authors=favorite_authors_norm,
            preference_summary=preference_summary,
            candidate_books=candidate_books,
        )

        if not settings.LLM_ENABLED:
            return fallback_rankings[:safe_limit]

        # Keep re-ranking pool bounded.
        pool_size = min(len(fallback_rankings), max(safe_limit * 3, 10))
        pool_ids = {item["book_id"] for item in fallback_rankings[:pool_size]}

        # Normalize candidate IDs to string for consistent comparison.
        pool_candidates = [
            book for book in candidate_books if _safe_str(book.get("id")) in pool_ids
        ]

        try:
            llm_rankings = self._rank_with_llm(
                favorite_tags=favorite_tags_norm,
                favorite_authors=favorite_authors_norm,
                preference_summary=preference_summary,
                candidate_books=pool_candidates,
                limit=safe_limit,
            )
        except Exception:
            return fallback_rankings[:safe_limit]

        if not llm_rankings:
            return fallback_rankings[:safe_limit]

        # Merge: LLM results first, then fallback fill.
        fallback_by_id = {item["book_id"]: item for item in fallback_rankings}
        ranked_results: list[dict[str, Any]] = []
        seen_ids: set[str] = set()

        for item in llm_rankings:
            book_id = _safe_str(item.get("book_id"))
            fallback_item = fallback_by_id.get(book_id)
            if not fallback_item or book_id in seen_ids:
                continue

            ranked_results.append(
                {
                    "book_id": book_id,
                    "score": self._normalize_score(item.get("score"), fallback_item["score"]),
                    "reasons": self._normalize_reasons(item.get("reasons")) or fallback_item["reasons"],
                }
            )
            seen_ids.add(book_id)

        for item in fallback_rankings:
            if item["book_id"] in seen_ids:
                continue
            ranked_results.append(item)

        return ranked_results[:safe_limit]

    # ---------- LLM re-ranking ----------

    def _rank_with_llm(
        self,
        favorite_tags: list[str],
        favorite_authors: list[str],
        preference_summary: str | None,
        candidate_books: list[dict[str, Any]],
        limit: int,
    ) -> list[dict[str, Any]]:
        if not candidate_books:
            return []

        reader_profile = (
            f"Preferred tags: {', '.join(favorite_tags) or 'none'}\n"
            f"Preferred authors: {', '.join(favorite_authors) or 'none'}\n"
            f"Preference summary: {preference_summary or 'none'}"
        )

        candidate_catalog = "\n\n".join(self._format_candidate_for_prompt(c) for c in candidate_books)

        raw_response = self.llm_service.rank_content_recommendations(
            reader_profile=reader_profile,
            candidate_catalog=candidate_catalog,
            limit=limit,
        )

        # Strict parsing: must be a JSON array. No "repair" beyond extraction.
        json_text = self._extract_json_array(raw_response)
        parsed = json.loads(json_text)
        if not isinstance(parsed, list):
            raise ValueError("LLM recommendation response must be a JSON array")

        allowed_ids = {str(book["id"]) for book in candidate_books}

        ranked: list[dict[str, Any]] = []
        for item in parsed:
            if not isinstance(item, dict):
                continue

            book_id = _safe_str(item.get("book_id"))
            if book_id not in allowed_ids:
                continue

            reasons = self._normalize_reasons(item.get("reasons"))
            if not reasons:
                continue

            ranked.append(
                {
                    "book_id": book_id,
                    "score": self._normalize_score(item.get("score"), 1),
                    "reasons": reasons,
                }
            )
        return ranked

    # ---------- Deterministic fallback ranking ----------

    def _rank_with_fallback(
        self,
        favorite_tags: list[str],
        favorite_authors: list[str],
        preference_summary: str | None,
        candidate_books: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        preferred_tags = {_normalize_term(t): t for t in favorite_tags}
        preferred_authors = {_normalize_term(a): a for a in favorite_authors}

        profile_terms = self._tokenize(" ".join([*favorite_tags, *favorite_authors, preference_summary or ""]))

        results: list[dict[str, Any]] = []
        for candidate in candidate_books:
            book_id = _safe_str(candidate.get("id"))
            title = _safe_str(candidate.get("title"))
            author = _safe_str(candidate.get("author") or "")
            summary = _safe_str(candidate.get("summary") or "")

            candidate_tags_raw = [str(tag) for tag in (candidate.get("tags") or [])]
            candidate_tags_norm = [_normalize_term(t) for t in candidate_tags_raw if str(t).strip()]

            score, reasons = self._score_candidate(
                preferred_tags=preferred_tags,
                preferred_authors=preferred_authors,
                profile_terms=profile_terms,
                title=title,
                author=author,
                tags_raw=candidate_tags_raw,
                tags_norm=candidate_tags_norm,
                summary=summary,
            )

            results.append(
                {
                    "book_id": book_id,
                    "score": score,
                    "reasons": reasons,
                }
            )

        # Stable ordering: score desc then book_id desc (or change to created_at if you have it).
        results.sort(key=lambda x: (x["score"], x["book_id"]), reverse=True)
        return results

    def _score_candidate(
        self,
        preferred_tags: dict[str, str],
        preferred_authors: dict[str, str],
        profile_terms: set[str],
        title: str,
        author: str,
        tags_raw: list[str],
        tags_norm: list[str],
        summary: str,
    ) -> tuple[int, list[str]]:
        score = 0
        reasons: list[str] = []

        # Tag alignment
        matching_tags = [tags_raw[i] for i, t in enumerate(tags_norm) if t in preferred_tags]
        if matching_tags:
            take = matching_tags[:3]
            score += len(take) * self.weights.tag_weight
            reasons.append(f"aligns with tags: {', '.join(take)}")

        # Author alignment
        author_norm = _normalize_term(author) if author else ""
        if author_norm and author_norm in preferred_authors:
            score += self.weights.author_weight
            reasons.append(f"matches preferred author {author}")

        # Thematic overlap (token-based)
        searchable_text = " ".join([title, author, " ".join(tags_raw), summary])
        candidate_terms = self._tokenize(searchable_text)
        overlap = profile_terms.intersection(candidate_terms)

        if len(overlap) >= 2:
            score += self.weights.theme_weight
            sample = sorted(list(overlap))[:3]
            reasons.append(f"shares themes: {', '.join(sample)}")

        # Summary presence bonus (small)
        if summary:
            score += self.weights.summary_bonus
            if not reasons:
                reasons.append("has summary content available for matching")

        if not reasons:
            reasons.append("unread title with adjacent catalog themes")

        score = max(1, min(score, self.weights.max_score))
        return score, reasons[:3]

    # ---------- Tokenization / normalization helpers ----------

    def _tokenize(self, value: str) -> set[str]:
        return {
            token
            for token in re.findall(r"[a-z0-9]+", (value or "").lower())
            if len(token) > 2 and token not in self._STOP_WORDS
        }

    def _extract_json_array(self, value: str) -> str:
        start = value.find("[")
        end = value.rfind("]")
        if start == -1 or end == -1 or end < start:
            raise ValueError("LLM recommendation response did not include a JSON array")
        return value[start : end + 1]

    def _normalize_reasons(self, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        normalized: list[str] = []
        for item in value:
            reason = _safe_str(item)
            if reason:
                normalized.append(reason)
            if len(normalized) == 3:
                break
        return normalized

    def _normalize_score(self, value: Any, fallback_score: int) -> int:
        try:
            score = int(value)
        except (TypeError, ValueError):
            return int(fallback_score)
        return max(1, min(score, self.weights.max_score))

    def _format_candidate_for_prompt(self, candidate: dict[str, Any]) -> str:
        candidate_tags = [str(tag) for tag in (candidate.get("tags") or [])]
        return (
            f"Book ID: {_safe_str(candidate.get('id'))}\n"
            f"Title: {_safe_str(candidate.get('title'))}\n"
            f"Author: {_safe_str(candidate.get('author') or 'Unknown author')}\n"
            f"Tags: {', '.join(candidate_tags) or 'none'}\n"
            f"Summary: {_safe_str(candidate.get('summary') or 'No generated summary yet.')[:320]}"
        )