"""Violation schema (engine output stored on the document)."""
from pydantic import BaseModel


class Violation(BaseModel):
    rule_id: str
    category: str | None = None
    severity: str = "info"
    description: str | None = None
    matched_text: str | None = None
    offset_start: int | None = None
    offset_end: int | None = None
    generic_fix: str | None = None
    ai_fix_suggestion: str | None = None
