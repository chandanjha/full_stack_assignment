from types import SimpleNamespace
from unittest.mock import Mock

import app.providers.intelligence as intelligence_module
from app.providers.intelligence import LocalReviewConsensusProvider


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
