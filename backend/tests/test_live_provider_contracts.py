"""Opt-in contracts for external providers; excluded from the default test run."""

import os

import pytest

from app.services.llm import llm_service
from app.tools.discovery_tools import fetch_page


pytestmark = pytest.mark.live_provider


def _live_tests_enabled() -> bool:
    return os.getenv("RUN_LIVE_PROVIDER_TESTS", "").strip().lower() == "true"


def test_live_llm_returns_structured_json():
    if not _live_tests_enabled():
        pytest.skip("Set RUN_LIVE_PROVIDER_TESTS=true to run live provider tests.")
    if not llm_service.available:
        pytest.skip("LLM_API_KEY is required for the live LLM contract test.")

    result = llm_service.complete_json(
        prompt='Return exactly {"status":"ok"}.',
        system="Return valid JSON only.",
        strict=True,
    )

    assert result == {"status": "ok"}


def test_live_discovery_fetch_returns_sanitized_visible_content():
    if not _live_tests_enabled():
        pytest.skip("Set RUN_LIVE_PROVIDER_TESTS=true to run live provider tests.")

    result = fetch_page("https://www.ugc.gov.in/", rate_limit_seconds=0)

    assert result["ok"] is True
    assert result["content_sanitized"] is True
    assert result["content"]
    assert result["original_content_length"] >= len(result["content"])