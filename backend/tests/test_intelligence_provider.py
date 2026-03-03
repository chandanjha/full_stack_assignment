from types import SimpleNamespace
from unittest.mock import Mock

import app.providers.intelligence as intelligence_module
from app.providers.intelligence import (
    LocalRecommendationRankingProvider,
    LocalReviewConsensusProvider,
)


def test_local_review_consensus_provider_uses_fallback_summary_when_llm_disabled(monkeypatch):
    monkeypatch.setattr(intelligence_module.settings, "LLM_ENABLED", False)
    provider = LocalReviewConsensusProvider(llm_service=Mock())
    reviews = [
        SimpleNamespace(rating=5, comment="Strong pacing and memorable characters."),
        SimpleNamespace(rating=2, comment="The middle section dragged."),
    ]

    summary = provider.summarize_reviews("Signals", reviews)

    assert "Sentiment Summary: Readers lean positive overall." in summary
    assert "Strong pacing and memorable characters." in summary
    assert "Average Rating Context: 3.5/5 across 2 review(s)" in summary


def test_local_recommendation_ranking_provider_uses_content_based_fallback_when_llm_disabled(monkeypatch):
    monkeypatch.setattr(intelligence_module.settings, "LLM_ENABLED", False)
    provider = LocalRecommendationRankingProvider(llm_service=Mock())

    rankings = provider.rank_books(
        favorite_tags=["architecture", "design"],
        favorite_authors=["Author A"],
        preference_summary="Prefers practical software architecture and design guidance.",
        candidate_books=[
            {
                "id": "book-1",
                "title": "Architecture Patterns",
                "author": "Author A",
                "tags": ["architecture", "engineering"],
                "summary": "Practical design trade-offs for building maintainable systems.",
                "summary_status": "completed",
            },
            {
                "id": "book-2",
                "title": "Poetry Collection",
                "author": "Author B",
                "tags": ["poetry"],
                "summary": "A reflective set of lyrical essays.",
                "summary_status": "completed",
            },
        ],
        limit=2,
    )

    assert [item["book_id"] for item in rankings] == ["book-1", "book-2"]
    assert rankings[0]["score"] > rankings[1]["score"]
    assert "aligns with tags: architecture" in rankings[0]["reasons"]
