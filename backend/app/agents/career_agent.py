from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import Document, Opportunity, StudentOpportunityMatch, StudentProfile
from app.services.llm import llm_service
from app.services.opportunity_status import is_recommendable


SKILL_SIGNALS = {
    "Python": ("python", "Build data and automation projects with Python."),
    "SQL": ("sql", "Practice querying, joins, window functions, and data modeling."),
    "Machine Learning": ("machine learning", "Complete one end-to-end ML project with evaluation."),
    "Deep Learning": ("deep learning", "Learn neural networks and reproduce a small experiment."),
    "Statistics": ("statistics", "Study probability, hypothesis testing, and experiment design."),
    "Research Methods": ("research", "Write a short literature review and document a reproducible method."),
    "Communication": ("communication", "Publish clear project notes and present one technical walkthrough."),
    "Leadership": ("lead", "Lead a small project or mentor a peer and record the outcome."),
}


class CareerRecommendationAgent:
    def generate(self, db: Session, profile: StudentProfile) -> dict[str, Any]:
        goals = profile.career_goals or ["AI Researcher"]
        career_goal = goals[0] if goals else "AI Researcher"

        resume = (
            db.query(Document)
            .filter(Document.student_id == profile.user_id, Document.document_type == "resume")
            .order_by(Document.uploaded_at.desc())
            .first()
        )
        resume_text = (resume.extracted_text or "").strip() if resume else ""
        evidence_text = " ".join(
            [
                resume_text.lower(),
                " ".join(profile.skills or []).lower(),
                " ".join(profile.interests or []).lower(),
                " ".join(profile.career_goals or []).lower(),
            ]
        )
        current_strengths = [skill for skill, (signal, _) in SKILL_SIGNALS.items() if signal in evidence_text]
        skill_gaps = [
            {
                "skill": skill,
                "priority": "high" if skill in {"Python", "Machine Learning", "Research Methods"} else "medium",
                "why": f"This is important for {career_goal} and was not clearly found in your current evidence.",
                "how_to_learn": advice,
            }
            for skill, (signal, advice) in SKILL_SIGNALS.items()
            if signal not in evidence_text
        ][:6]

        matches = (
            db.query(StudentOpportunityMatch)
            .filter(StudentOpportunityMatch.student_id == profile.user_id)
            .order_by(StudentOpportunityMatch.ranking_score.desc())
            .limit(12)
            .all()
        )
        matches = [m for m in matches if m.opportunity and is_recommendable(m.opportunity)]
        linked_ids = [m.opportunity_id for m in matches]
        opps = {
            o.id: o
            for o in db.query(Opportunity).filter(Opportunity.id.in_(linked_ids)).all()
        } if linked_ids else {}

        # Map real opportunities into yearly roadmap buckets
        year_map: dict[int, list[dict[str, Any]]] = {2026: [], 2027: [], 2028: []}
        for match in matches:
            opp = opps.get(match.opportunity_id)
            if not opp:
                continue
            item = {
                "title": opp.title,
                "type": opp.opportunity_type,
                "opportunity_id": opp.id,
                "match": match.ranking_score,
            }
            if opp.opportunity_type in {"internship", "competition", "research"}:
                year_map[2026].append(item)
            elif opp.opportunity_type in {"scholarship", "grant"}:
                year_map[2027].append(item)
            else:
                year_map[2028].append(item)

        # Ensure demo-friendly defaults if sparse
        defaults = {
            2026: ["Research Internship", "ML Project", "Research Fellowship"],
            2027: ["Graduate Scholarship", "Research Assistantship", "Conference"],
            2028: ["MS/PhD Applications", "Research Funding"],
        }
        years = []
        for year, default_items in defaults.items():
            items = year_map[year]
            if not items:
                items = [{"title": t, "type": "milestone", "opportunity_id": None, "match": None} for t in default_items]
            years.append({"year": year, "items": items[:5]})

        llm_data = llm_service.complete_json(
            prompt=(
                "Create a practical career roadmap from the supplied student evidence. "
                "Return JSON with keys summary, current_strengths, skill_gaps, action_plan, weekly_routine, years. "
                "skill_gaps must be [{skill,priority,why,how_to_learn}], action_plan must be "
                "[{title,timeframe,actions,proof}], weekly_routine must be a list of strings, and years "
                "must be [{year,title,milestones,skills_to_develop}]. Do not invent resume facts or credentials. "
                f"Goal: {career_goal}. Profile skills={profile.skills}; interests={profile.interests}; "
                f"degree={profile.degree}; field={profile.field_of_study}. "
                f"Resume text: {resume_text[:6000] or '[no resume uploaded]'}. "
                f"Current strengths detected: {current_strengths}. Suggested gaps: {skill_gaps}. "
                f"Real linked opportunities: {year_map}"
            ),
            system="Career coach for EduPath. Be specific, evidence-grounded, and honest about missing information.",
        )
        summary = llm_data.get("summary") or (
            f"Personalized pathway toward becoming an {career_goal}, connected to your current matches."
        )

        action_plan = llm_data.get("action_plan") or [
            {
                "title": "Strengthen your evidence",
                "timeframe": "Next 2 weeks",
                "actions": ["Update your resume with measurable outcomes", "Choose one missing skill to study"],
                "proof": "A revised resume and one completed learning artifact",
            },
            {
                "title": "Build one target project",
                "timeframe": "Next 6 weeks",
                "actions": ["Build a project aligned with your target role", "Publish a short README and results"],
                "proof": "A public or shareable project with documented results",
            },
        ]
        weekly_routine = llm_data.get("weekly_routine") or [
            "3 hours: structured learning for the highest-priority skill",
            "3 hours: build or improve one portfolio project",
            "1 hour: read, summarize, or discuss one field-relevant paper or article",
            "30 minutes: update your resume or application evidence",
        ]
        model_gaps = llm_data.get("skill_gaps")
        model_strengths = llm_data.get("current_strengths")
        years_from_model = llm_data.get("years")
        if isinstance(model_gaps, list):
            skill_gaps = model_gaps[:8]
        if isinstance(model_strengths, list):
            current_strengths = [str(item) for item in model_strengths[:8]]
        if isinstance(years_from_model, list) and years_from_model:
            years = years_from_model

        normalized_years = []
        for index, year_data in enumerate(years):
            if not isinstance(year_data, dict):
                continue
            milestones = year_data.get("milestones")
            if not isinstance(milestones, list):
                milestones = year_data.get("items") if isinstance(year_data.get("items"), list) else []
            skills_to_develop = year_data.get("skills_to_develop")
            if not isinstance(skills_to_develop, list):
                skills_to_develop = []
            normalized_years.append(
                {
                    **year_data,
                    "year": year_data.get("year", 2026 + index),
                    "title": str(year_data.get("title") or f"Year {index + 1}"),
                    "milestones": [str(item) for item in milestones],
                    "skills_to_develop": [str(item) for item in skills_to_develop],
                }
            )
        years = normalized_years

        return {
            "career_goal": career_goal,
            "years": years,
            "linked_opportunity_ids": linked_ids,
            "summary": summary,
            "resume_analyzed": bool(resume_text),
            "resume_file_name": resume.file_name if resume else None,
            "current_strengths": current_strengths,
            "skill_gaps": skill_gaps,
            "action_plan": action_plan,
            "weekly_routine": weekly_routine,
        }
