"""Document schemas (Phase 1 subset; extended in later phases)."""
from datetime import datetime
from typing import Literal, Any

from pydantic import BaseModel

DocStatus = Literal["pending", "extracting", "classifying", "validating", "completed", "failed"]
ApprovalStatus = Literal["pending", "approved", "rejected"]


class DocumentPublic(BaseModel):
    id: str
    filename: str
    original_name: str
    file_type: str
    uploader_id: str
    status: DocStatus
    checklist_id: str | None = None
    classification: str | None = None
    confidence_score: float | None = None
    risk_level: str | None = None
    risk_score: int | None = None
    approval_status: ApprovalStatus = "pending"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class DocumentDetail(DocumentPublic):
    """Full document view including compliance results (for the review screen)."""
    checklist_id: str | None = None
    summary: str | None = None
    key_clauses: list[str] = []
    document_purpose: str | None = None
    violations: list[dict[str, Any]] = []
    rejection_reason: str | None = None
    comments: list[Any] = []
    audit_report_path: str | None = None


class UploadResponse(BaseModel):
    document_ids: list[str]
    count: int
    detail: str = "Upload accepted; processing started."


class StatusResponse(BaseModel):
    id: str
    status: DocStatus
    classification: str | None = None
    confidence_score: float | None = None
    progress_percent: int = 0
    extra: dict[str, Any] | None = None
