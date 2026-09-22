from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from urllib.parse import urlparse

from pydantic import BaseModel, Field

from app.services.llm import llm_service
from app.tools.discovery_tools import sanitize_content_for_llm


class ExtractedEligibility(BaseModel):
    education_level: list[str] = Field(default_factory=list)
    fields: list[str] = Field(default_factory=list)
    minimum_gpa: Optional[float] = None
    maximum_income: Optional[float] = None
    countries: list[str] = Field(default_factory=list)
    states: list[str] = Field(default_factory=list)
    citizenship: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    career_goals: list[str] = Field(default_factory=list)


class ExtractedOpportunity(BaseModel):
    title: str
    provider: str
    type: str = "scholarship"
    amount: Optional[float] = None
    currency: str = "USD"
    deadline: Optional[str] = None
    eligibility: ExtractedEligibility = Field(default_factory=ExtractedEligibility)
    required_documents: list[str] = Field(default_factory=list)
    application_url: Optional[str] = None
    official_source: Optional[str] = None
    description: str = ""
    location: Optional[str] = None
    verification_status: str = "Unknown"


class ExtractionAgent:
    """Extract structured opportunity info. Never invent official URLs or amounts."""

    def extract(self, url: str, content: str) -> ExtractedOpportunity:
        # Only extract conservatively from page content.
        # If LLM is available, ask it to extract ONLY facts present in the text.
        if llm_service.available and content:
            content = sanitize_content_for_llm(content)
            result = llm_service.complete_json(
                prompt=(
                    "Extract scholarship/opportunity fields ONLY if explicitly present in the content. "
                    "If unknown, use null/empty. Never invent amounts, deadlines, or URLs.\n"
                    f"URL: {url}\nCONTENT:\n{content[:8000]}"
                ),
                system="You are a careful information extraction agent for EduPath AI.",
            )
            if result.get("title") and result.get("provider"):
                try:
                    return ExtractedOpportunity(
                        title=result["title"],
                        provider=result["provider"],
                        type=result.get("type") or "scholarship",
                        amount=result.get("amount"),
                        currency=result.get("currency") or "USD",
                        deadline=result.get("deadline"),
                        eligibility=ExtractedEligibility(**(result.get("eligibility") or {})),
                        required_documents=result.get("required_documents") or [],
                        application_url=result.get("application_url") or url,
                        official_source=result.get("official_source") or url,
                        description=result.get("description") or "",
                        location=result.get("location"),
                        verification_status="Unknown",
                    )
                except Exception:  # noqa: BLE001
                    pass

        parsed_url = urlparse(url)
        host = parsed_url.netloc.removeprefix("www.")
        path = parsed_url.path.strip("/").replace("-", " ").replace("_", " ")
        title = path.title() if path else f"Current Opportunities on {host}"
        return ExtractedOpportunity(
            title=title,
            provider=host or "Unknown",
            type="scholarship",
            application_url=url,
            official_source=url,
            description="Live official source page. Detailed opportunity fields could not yet be extracted.",
            verification_status="Pending",
        )

    @staticmethod
    def parse_deadline(value: Optional[str]) -> Optional[date]:
        if not value:
            return None
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%B %d, %Y"):
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue
        return None
