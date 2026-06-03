"""Checklist + rule schemas for the compliance API."""
from typing import Literal

from pydantic import BaseModel, Field

Severity = Literal["critical", "warning", "info"]
DetectionType = Literal["pattern", "keyword_required", "keyword_forbidden", "nlp_entity"]


class Rule(BaseModel):
    id: str
    category: str
    description: str
    severity: Severity = "info"
    detection_type: DetectionType
    pattern: str | None = None
    keywords: list[str] | None = None
    entity_type: str | None = None
    generic_fix: str = ""


class ChecklistCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=2, max_length=60, pattern=r"^[a-z0-9_\-]+$")
    version: str = "1.0"
    rules: list[Rule] = Field(default_factory=list)


class ChecklistUpdate(BaseModel):
    name: str | None = None
    version: str | None = None
    rules: list[Rule] | None = None


class ChecklistPublic(BaseModel):
    slug: str
    name: str
    version: str = "1.0"
    is_builtin: bool = False
    rule_count: int = 0
    rules: list[Rule] = Field(default_factory=list)
