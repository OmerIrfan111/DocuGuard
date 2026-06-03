"""Compliance rule engine.

Pure (no DB / no network): given decrypted text and a checklist dict, produce a list of
violations with precise character offsets plus a 0-100 risk score and risk level.

Detection types:
  - pattern           — regex match; violation if the pattern is FOUND
  - keyword_required  — violation if NONE of the keywords are present (absence)
  - keyword_forbidden — violation if ANY keyword is present
  - nlp_entity        — spaCy NER; violation if an entity of the configured type is present
"""
import re

from app.services import nlp_service

WEIGHTS = {"critical": 40, "warning": 20, "info": 5}


def risk_level(score: int) -> str:
    if score <= 30:
        return "Low"
    if score <= 60:
        return "Medium"
    return "High"


def calculate_risk_score(violations: list[dict]) -> int:
    return min(sum(WEIGHTS.get(v.get("severity"), 0) for v in violations), 100)


def _violation(rule: dict, matched_text, start, end) -> dict:
    return {
        "rule_id": rule.get("id"),
        "category": rule.get("category"),
        "severity": rule.get("severity", "info"),
        "description": rule.get("description"),
        "matched_text": matched_text,
        "offset_start": start,
        "offset_end": end,
        "generic_fix": rule.get("generic_fix"),
        "ai_fix_suggestion": None,  # filled in by the Celery task via Bedrock
    }


def _detect(rule: dict, text: str, text_lower: str) -> list[dict]:
    dtype = rule.get("detection_type")

    if dtype == "pattern":
        try:
            match = re.search(rule.get("pattern", ""), text)
        except re.error:
            return []
        if match:
            return [_violation(rule, match.group(0), match.start(), match.end())]
        return []

    if dtype == "keyword_forbidden":
        for kw in rule.get("keywords", []):
            idx = text_lower.find(kw.lower())
            if idx != -1:
                return [_violation(rule, text[idx:idx + len(kw)], idx, idx + len(kw))]
        return []

    if dtype == "keyword_required":
        present = any(kw.lower() in text_lower for kw in rule.get("keywords", []))
        if not present:
            # Absence violation — no offset to highlight.
            return [_violation(rule, None, None, None)]
        return []

    if dtype == "nlp_entity":
        entities = nlp_service.extract_entities(text, rule.get("entity_type"))
        if entities:
            e = entities[0]
            return [_violation(rule, e["text"], e["start"], e["end"])]
        return []

    return []


def evaluate(text: str, checklist: dict) -> tuple[list[dict], int, str]:
    """Return (violations, risk_score, risk_level)."""
    text = text or ""
    text_lower = text.lower()
    violations: list[dict] = []
    for rule in (checklist or {}).get("rules", []):
        violations.extend(_detect(rule, text, text_lower))
    score = calculate_risk_score(violations)
    return violations, score, risk_level(score)


def context_window(text: str, start, end, radius: int = 200) -> str:
    """Surrounding text around a match, used to give Bedrock context for fix suggestions."""
    if start is None or end is None:
        return (text or "")[:radius]
    lo = max(0, start - radius)
    hi = min(len(text), end + radius)
    return text[lo:hi]
