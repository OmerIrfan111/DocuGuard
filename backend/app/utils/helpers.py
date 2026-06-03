"""Small shared helpers: Mongo serialization + audit logging."""
from datetime import datetime, timezone

from app.database import db


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def serialize(doc: dict | None) -> dict | None:
    """Convert a Mongo document for JSON output: _id -> id (str), drop sensitive fields."""
    if doc is None:
        return None
    out = dict(doc)
    if "_id" in out:
        out["id"] = str(out.pop("_id"))
    out.pop("hashed_password", None)
    # Never leak ciphertext of extracted_text in generic serialization.
    out.pop("extracted_text", None)
    return out


async def write_audit_log(
    *,
    user_id: str | None,
    user_email: str | None,
    action: str,
    document_id: str | None = None,
    document_name: str | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
) -> None:
    await db.audit_logs.insert_one({
        "user_id": user_id,
        "user_email": user_email,
        "action": action,
        "document_id": document_id,
        "document_name": document_name,
        "metadata": metadata or {},
        "ip_address": ip_address,
        "timestamp": utcnow(),
    })
