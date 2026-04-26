"""
Module 2 (Member 3): Combined AI Support Module
Free/Open-source friendly implementation (no paid OpenAI key required).

This module now combines:
1) Policy validation
2) Campus chatbot
3) Student weakness analysis + trend detection

Input format for analysis (recommended for demo):
- List of terms where each term has subject->mark map.
- Example:
  [
    {"semester": "Spring-2025", "marks": {"Math": 62, "Physics": 71}},
    {"semester": "Fall-2025", "marks": {"Math": 55, "Physics": 74}}
  ]
"""

from __future__ import annotations

from dataclasses import dataclass
from statistics import mean
from typing import Any

try:
    from fastapi import APIRouter
    from pydantic import BaseModel
except Exception:  # Allows using pure functions without FastAPI installed.
    APIRouter = None
    BaseModel = object


@dataclass
class AnalysisResult:
    weak_subjects: list[str]
    strong_subjects: list[str]
    performance_trends: dict[str, str]
    weakness_summary: str
    recommended_focus: list[str]
    suggested_study_plan: str
    tutor_assistance_summary: str


@dataclass
class PolicyValidationResult:
    flagged: bool
    risk_score: int
    violations: list[str]
    suggestions: list[str]


def validate_policy_text(policy_text: str) -> PolicyValidationResult:
    """Validate provider policy text using deterministic rules."""
    text = (policy_text or "").lower()

    discriminatory_terms = [
        "male only",
        "female only",
        "religion",
        "race",
        "ethnicity",
        "disabled not allowed",
        "poor students not allowed",
    ]
    harmful_terms = [
        "punish",
        "humiliate",
        "insult",
        "threat",
        "blackmail",
    ]
    unethical_terms = [
        "no refund under any condition",
        "take extra money without notice",
        "force payment",
        "collect personal password",
    ]
    abusive_terms = [
        "stupid",
        "idiot",
        "useless",
        "shut up",
    ]

    violations: list[str] = []
    risk_score = 0

    if any(term in text for term in discriminatory_terms):
        violations.append("Potential discrimination detected")
        risk_score += 35

    if any(term in text for term in harmful_terms):
        violations.append("Potential harmful/violent instruction detected")
        risk_score += 30

    if any(term in text for term in unethical_terms):
        violations.append("Potential unethical restriction detected")
        risk_score += 20

    if any(term in text for term in abusive_terms):
        violations.append("Abusive language detected")
        risk_score += 15

    suggestions: list[str] = []
    if violations:
        suggestions = [
            "Use neutral, inclusive language.",
            "Avoid threats, humiliation, or discriminatory clauses.",
            "Add fair cancellation and refund terms.",
            "Keep policies role-focused and professional.",
        ]

    return PolicyValidationResult(
        flagged=len(violations) > 0,
        risk_score=min(risk_score, 100),
        violations=violations,
        suggestions=suggestions,
    )


FAQ_RESPONSES = {
    "book service": "Go to Services, choose a provider, select slot/date, then confirm booking.",
    "cancel booking": "Open My Bookings and choose Cancel for pending bookings.",
    "reschedule": "From My Bookings, pick Reschedule and select a new available slot.",
    "marketplace": "Use Marketplace filters by keyword, category, and price range.",
    "tutor": "You can search tutoring services and compare provider ratings.",
    "notification": "Check Notifications page for booking updates and reminders.",
    "policy": "Providers should write fair, non-discriminatory service policies.",
}


def chatbot_reply(message: str) -> str:
    """Simple local chatbot logic based on keyword intent matching."""
    text = (message or "").strip().lower()
    if not text:
        return "Please type your question."

    for key, response in FAQ_RESPONSES.items():
        if key in text:
            return response

    return (
        "I can help with booking, reschedule, marketplace, tutor search, and policies. "
        "Try asking: 'How do I book service?'"
    )


def _trend_label(first: float, last: float) -> str:
    delta = last - first
    if delta >= 5:
        return "improving"
    if delta <= -5:
        return "declining"
    return "stable"


def analyze_marksheet_terms(
    terms: list[dict[str, Any]],
    weak_threshold: float = 60.0,
    strong_threshold: float = 80.0,
) -> AnalysisResult:
    """Analyze subject performance across terms using local deterministic logic."""
    subject_history: dict[str, list[float]] = {}

    for term in terms:
        marks = term.get("marks", {})
        for subject, score in marks.items():
            try:
                subject_history.setdefault(subject, []).append(float(score))
            except Exception:
                continue

    if not subject_history:
        return AnalysisResult(
            weak_subjects=[],
            strong_subjects=[],
            performance_trends={},
            weakness_summary="No valid subject marks provided.",
            recommended_focus=[],
            suggested_study_plan="Prepare valid marks input first.",
            tutor_assistance_summary="No tutor summary available.",
        )

    averages = {subject: mean(scores) for subject, scores in subject_history.items()}

    weak_subjects = [s for s, avg in averages.items() if avg < weak_threshold]
    strong_subjects = [s for s, avg in averages.items() if avg >= strong_threshold]

    trends: dict[str, str] = {}
    for subject, scores in subject_history.items():
        if len(scores) == 1:
            trends[subject] = "single-term"
        else:
            trends[subject] = _trend_label(scores[0], scores[-1])

    if weak_subjects:
        weakness_summary = (
            "Student shows weakness in: " + ", ".join(weak_subjects) +
            ". Prioritize concept revision and weekly practice."
        )
    else:
        weakness_summary = "No critical weak subjects detected from provided marks."

    recommended_focus = []
    for s in weak_subjects:
        recommended_focus.append(f"{s}: core concepts + past paper practice")
        if trends.get(s) == "declining":
            recommended_focus.append(f"{s}: urgent recovery plan (2 extra sessions/week)")

    if not recommended_focus:
        recommended_focus = ["Maintain current progress and target advanced practice sets."]

    suggested_study_plan = (
        "4-week plan: Week 1 concept revision, Week 2 guided problems, "
        "Week 3 timed practice, Week 4 mock tests and error-log review."
    )

    tutor_assistance_summary = (
        "Tutor should start with weak subjects first, track weekly quiz scores, "
        "and adjust difficulty based on trend signals."
    )

    return AnalysisResult(
        weak_subjects=weak_subjects,
        strong_subjects=strong_subjects,
        performance_trends=trends,
        weakness_summary=weakness_summary,
        recommended_focus=recommended_focus,
        suggested_study_plan=suggested_study_plan,
        tutor_assistance_summary=tutor_assistance_summary,
    )


# Optional router for easy API demo.
if APIRouter is not None and BaseModel is not object:
    router = APIRouter(prefix="/api/member3/module2", tags=["Member3 Module2"])

    class PolicyValidationRequest(BaseModel):
        policy_text: str

    class ChatRequest(BaseModel):
        message: str

    class TermInput(BaseModel):
        semester: str
        marks: dict[str, float]

    class AnalysisRequest(BaseModel):
        terms: list[TermInput]

    @router.post("/validate-policy")
    def validate_policy(payload: PolicyValidationRequest) -> dict[str, Any]:
        result = validate_policy_text(payload.policy_text)
        return {
            "flagged": result.flagged,
            "risk_score": result.risk_score,
            "violations": result.violations,
            "suggestions": result.suggestions,
            "engine": "rule-based-local",
        }

    @router.post("/chat")
    def chat(payload: ChatRequest) -> dict[str, str]:
        return {
            "response": chatbot_reply(payload.message),
            "engine": "faq-intent-local",
        }

    @router.post("/analyze")
    def analyze(payload: AnalysisRequest) -> dict[str, Any]:
        terms_data = [t.model_dump() for t in payload.terms]
        result = analyze_marksheet_terms(terms_data)
        return {
            "weak_subjects": result.weak_subjects,
            "strong_subjects": result.strong_subjects,
            "performance_trends": result.performance_trends,
            "weakness_summary": result.weakness_summary,
            "recommended_focus": result.recommended_focus,
            "suggested_study_plan": result.suggested_study_plan,
            "tutor_assistance_summary": result.tutor_assistance_summary,
            "engine": "rule-based-local",
        }
