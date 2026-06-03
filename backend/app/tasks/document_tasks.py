"""Document processing pipeline — chained Celery tasks.

Phase 2 implements real OCR/extraction and classification (extract_text, classify_document).
run_compliance and generate_summary remain status-only placeholders until Phase 3. Each task
updates the document ``status`` in MongoDB so the frontend polling endpoint reflects progress.

Celery workers are synchronous, so DB access here uses a short-lived sync PyMongo client
(the FastAPI app itself uses Motor/async per the project constraint).
"""
from datetime import datetime, timezone

from celery import chain
from pymongo import MongoClient
from bson import ObjectId

from app.config import settings
from app.tasks.celery_app import celery_app


def _db():
    client = MongoClient(settings.MONGODB_URI)
    return client, client[settings.MONGODB_DB_NAME]


def _set_status(document_id: str, status: str, extra: dict | None = None) -> None:
    client, database = _db()
    try:
        update = {"status": status, "updated_at": datetime.now(timezone.utc)}
        if extra:
            update.update(extra)
        database.documents.update_one({"_id": ObjectId(document_id)}, {"$set": update})
    finally:
        client.close()


def _get_document(document_id: str) -> dict | None:
    client, database = _db()
    try:
        return database.documents.find_one({"_id": ObjectId(document_id)})
    finally:
        client.close()


@celery_app.task(name="documents.extract_text", bind=True)
def extract_text(self, document_id: str) -> str | None:
    """[Phase 2] Extract text (Tesseract/Tika → Textract fallback), encrypt, and store."""
    if not document_id:
        return None
    _set_status(document_id, "extracting")
    try:
        from app.services.ocr_service import extract_text as run_ocr
        from app.services.storage_service import get_file_path
        from app.utils.encryption import encrypt_text

        doc = _get_document(document_id)
        if not doc:
            return None

        abs_path = str(get_file_path(doc["file_path"]))
        text = run_ocr(abs_path, doc["file_type"]) or ""
        # extracted_text is encrypted at rest (AES-256 Fernet).
        ciphertext = encrypt_text(text) if text else None
        _set_status(document_id, "extracting", {
            "extracted_text": ciphertext,
            "extracted_char_count": len(text),
        })
        return document_id
    except Exception as exc:  # noqa: BLE001 — pipeline must fail soft
        _set_status(document_id, "failed", {"error": f"extract_text: {exc}"})
        return None


@celery_app.task(name="documents.classify_document")
def classify_document(document_id: str) -> str | None:
    """[Phase 2] Rule-based → Bedrock fallback classification."""
    if not document_id:
        return None
    _set_status(document_id, "classifying")
    try:
        from app.services.classifier_service import classify
        from app.utils.encryption import decrypt_text

        doc = _get_document(document_id)
        if not doc:
            return None

        ciphertext = doc.get("extracted_text")
        text = decrypt_text(ciphertext) if ciphertext else ""
        result = classify(text)
        _set_status(document_id, "classifying", {
            "classification": result.get("document_type"),
            "confidence_score": result.get("confidence"),
        })
        return document_id
    except Exception as exc:  # noqa: BLE001
        _set_status(document_id, "failed", {"error": f"classify_document: {exc}"})
        return None


def _resolve_checklist(slug: str | None) -> dict:
    """Resolve a checklist by slug: built-in JSON file first, then a custom MongoDB checklist."""
    from app.services.checklist_service import load_builtin
    builtin = load_builtin(slug) if slug else None
    if builtin:
        return builtin
    if slug:
        client, database = _db()
        try:
            custom = database.checklists.find_one({"slug": slug})
            if custom:
                return custom
        finally:
            client.close()
    return {"rules": []}


@celery_app.task(name="documents.run_compliance")
def run_compliance(document_id: str) -> str | None:
    """[Phase 3] Run the compliance engine + attach per-violation Bedrock fix suggestions."""
    if not document_id:
        return None
    _set_status(document_id, "validating")
    try:
        from app.services.compliance_engine import evaluate, context_window
        from app.services.bedrock_service import get_ai_fix_suggestion
        from app.utils.encryption import decrypt_text

        doc = _get_document(document_id)
        if not doc:
            return None

        ciphertext = doc.get("extracted_text")
        text = decrypt_text(ciphertext) if ciphertext else ""
        checklist = _resolve_checklist(doc.get("checklist_id"))
        violations, score, level = evaluate(text, checklist)

        # AI fix suggestion per violation (Bedrock; falls back to a safe string if unavailable).
        for v in violations:
            ctx = context_window(text, v["offset_start"], v["offset_end"])
            v["ai_fix_suggestion"] = get_ai_fix_suggestion(
                v.get("description") or "", v.get("matched_text") or "(required content absent)", ctx,
            )

        _set_status(document_id, "validating", {
            "violations": violations,
            "risk_score": score,
            "risk_level": level,
        })
        return document_id
    except Exception as exc:  # noqa: BLE001
        _set_status(document_id, "failed", {"error": f"run_compliance: {exc}"})
        return None


@celery_app.task(name="documents.generate_summary")
def generate_summary(document_id: str) -> str | None:
    """[Phase 3] Bedrock document summary; marks the document completed."""
    if not document_id:
        return None
    try:
        from app.services.bedrock_service import summarize_document
        from app.utils.encryption import decrypt_text

        doc = _get_document(document_id)
        if not doc:
            return None

        ciphertext = doc.get("extracted_text")
        text = decrypt_text(ciphertext) if ciphertext else ""
        summary = summarize_document(text)
        _set_status(document_id, "completed", {
            "summary": summary.get("summary"),
            "key_clauses": summary.get("key_clauses", []),
            "document_purpose": summary.get("document_purpose"),
        })
        return document_id
    except Exception as exc:  # noqa: BLE001
        _set_status(document_id, "failed", {"error": f"generate_summary: {exc}"})
        return None


@celery_app.task(name="documents.notify_reviewers")
def notify_reviewers(document_id: str) -> str | None:
    """[Phase 3/4] Notify all reviewers + admins that a document finished processing."""
    if not document_id:
        return None
    client, database = _db()
    try:
        doc = database.documents.find_one({"_id": ObjectId(document_id)})
        if not doc:
            return None
        message = (
            f"{doc.get('original_name', 'A document')} finished processing — "
            f"risk: {doc.get('risk_level', 'Unknown')} "
            f"({len(doc.get('violations', []))} violations)"
        )
        recipients = database.users.find({"role": {"$in": ["reviewer", "admin"]}})
        notifications = [{
            "user_id": str(u["_id"]),
            "message": message,
            "document_id": document_id,
            "type": "violation" if doc.get("risk_level") == "High" else "upload",
            "read": False,
            "created_at": datetime.now(timezone.utc),
        } for u in recipients]
        if notifications:
            database.notifications.insert_many(notifications)
        return document_id
    finally:
        client.close()


def start_pipeline(document_id: str):
    """Enqueue the full chain: extract → classify → validate → summarise → notify."""
    return chain(
        extract_text.s(document_id),
        classify_document.s(),
        run_compliance.s(),
        generate_summary.s(),
        notify_reviewers.s(),
    ).apply_async()


def start_revalidation(document_id: str):
    """Re-run compliance + summary on an already-extracted document (e.g. after a checklist change)."""
    return chain(
        run_compliance.s(document_id),
        generate_summary.s(),
        notify_reviewers.s(),
    ).apply_async()
