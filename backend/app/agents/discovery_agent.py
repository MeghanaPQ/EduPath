from __future__ import annotations

from datetime import datetime
from typing import Any
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.agents.extraction_agent import ExtractionAgent
from app.config import get_settings
from app.models import StudentProfile
from app.services import agent_logger
from app.tools.discovery_tools import (
    check_duplicate,
    fetch_page,
    load_trusted_sources,
    save_opportunity,
    search_web,
)


class DiscoveryAgent:
    """Discover Indian scholarships from trusted official sources."""

    def __init__(self) -> None:
        self.extraction = ExtractionAgent()
        self.settings = get_settings()

    def discover(
        self,
        db: Session,
        profile: StudentProfile,
        *,
        parent_run_id: str | None = None,
        include_new_demo_opportunity: bool = False,
    ) -> dict[str, Any]:
        run = agent_logger.start_agent_run(
            db,
            agent_name="discovery_agent",
            run_type="discovery",
            student_id=profile.user_id,
            input_summary=(
                f"India scholarship discovery for {profile.field_of_study or 'student'} "
                f"in {profile.state or profile.country or 'India'}"
            ),
            parent_run_id=parent_run_id,
        )

        sources = [s for s in load_trusted_sources() if s.get("country") in {"IN", "India", None} or s.get("enabled")]
        india_sources = [s for s in sources if str(s.get("country", "IN")).upper() in {"IN", "INDIA"}]
        if not india_sources:
            india_sources = sources
        agent_logger.append_step(db, run, f"Connected to {len(india_sources)} India trusted sources")

        query = " ".join(
            [
                "India scholarships",
                profile.field_of_study or "",
                profile.education_level or profile.degree or "",
                " ".join(profile.interests or []),
                profile.category or "",
            ]
        ).strip()
        search_results = search_web(query)
        agent_logger.append_step(db, run, f"Scanned {len(search_results)} sources", data={"query": query})

        discovered_payloads: list[dict[str, Any]] = []
        duplicates = 0
        invalid_pages = 0
        live_checked = 0

        # Probe trusted live sources until five pages have been fetched successfully.
        for source in india_sources:
            if live_checked >= 5:
                break
            page = fetch_page(source["url"], rate_limit_seconds=1.0)
            if page.get("ok"):
                live_checked += 1
                agent_logger.append_step(db, run, f"Fetched trusted source: {source['name']}")
                live_added = self._index_live_source_pages(db, source, page)
                if live_added:
                    discovered_payloads.extend(live_added)
                    agent_logger.append_step(
                        db,
                        run,
                        f"Added {len(live_added)} current listings from {source['name']}",
                    )
            else:
                invalid_pages += 1
                agent_logger.append_step(
                    db, run, f"Source unavailable: {source['name']}", status="warning"
                )

        new_count = sum(1 for o in discovered_payloads if o.get("is_new"))
        agent_logger.append_step(
            db,
            run,
            f"Indexed {len(discovered_payloads)} India opportunities ({new_count} new); "
            f"live-checked {live_checked} pages",
        )
        agent_logger.complete_agent_run(
            db,
            run,
            output_summary=f"India discovery indexed {len(discovered_payloads)} opportunities",
            metadata={
                "discovered": len(discovered_payloads),
                "new": new_count,
                "duplicates": duplicates,
                "invalid_pages": invalid_pages,
                "sources_scanned": len(search_results),
                "live_checked": live_checked,
                "country": "India",
            },
        )
        return {
            "run_id": run.id,
            "opportunities": discovered_payloads,
            "duplicates": duplicates,
            "invalid_pages": invalid_pages,
            "sources_scanned": len(search_results),
            "steps": run.steps,
        }

    def _index_live_source_pages(
        self,
        db: Session,
        source: dict[str, Any],
        landing_page: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Index a small set of explicit listings from the current trusted page."""
        source_url = source["url"]
        source_host = urlparse(source_url).netloc.lower()
        links = [source_url]
        for link in landing_page.get("links") or []:
            parsed = urlparse(link)
            label = link.lower()
            if parsed.netloc.lower() != source_host:
                continue
            if any(word in label for word in ("scholar", "fellow", "grant", "scheme", "award", "fund")):
                links.append(link)
        discovered: list[dict[str, Any]] = []
        seen_urls: set[str] = set()
        for candidate_url in links[:3]:
            if candidate_url in seen_urls:
                continue
            seen_urls.add(candidate_url)
            page = landing_page if candidate_url == source_url else fetch_page(candidate_url, rate_limit_seconds=0.3)
            if not page.get("ok"):
                continue
            extracted = self.extraction.extract(candidate_url, page.get("content") or "")
            if extracted.title == "Unverified Opportunity Listing" and extracted.provider == "Unknown":
                continue
            official_url = candidate_url
            existing = check_duplicate(db, extracted.title, extracted.provider, official_url)
            if existing:
                continue
            payload = {
                "title": extracted.title,
                "provider": extracted.provider,
                "opportunity_type": extracted.type,
                "description": extracted.description,
                "amount": extracted.amount,
                "currency": extracted.currency or "INR",
                "deadline": self.extraction.parse_deadline(extracted.deadline),
                "location": extracted.location or "India",
                "eligibility_text": None,
                "required_documents": extracted.required_documents or [],
                "official_source_url": official_url,
                "application_url": official_url,
                "source_name": source["name"],
                "source_verified": True,
                "last_verified_at": datetime.utcnow(),
                "status": "open",
                "eligibility": extracted.eligibility.model_dump(),
                "is_demo": False,
            }
            opportunity = save_opportunity(db, payload, is_demo=False)
            discovered.append({"id": opportunity.id, "title": opportunity.title, "is_new": True, "live": True})
        return discovered
