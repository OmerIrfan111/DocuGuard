"""Document upload + status + listing.

Phase 1 implements secure local-filesystem upload, the MongoDB document record, status
polling, and kicks off the (placeholder) Celery pipeline. OCR/classification land in Phase 2.
"""
import uuid

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, status

from app.config import settings
from app.database import db
from fastapi.responses import FileResponse

from app.dependencies import get_current_user, require_role
from app.models.document import (
    UploadResponse, StatusResponse, DocumentPublic, DocumentDetail,
    RejectRequest, PaginatedDocuments,
)
from app.services import storage_service
from app.services.file_validation import detect_file_type
from app.tasks.document_tasks import start_pipeline
from app.utils.helpers import utcnow, serialize, write_audit_log, create_notification
from app.rate_limit import limiter

router = APIRouter(prefix="/api/documents", tags=["documents"])

_PROGRESS = {
    "pending": 5, "extracting": 25, "classifying": 50,
    "validating": 75, "completed": 100, "failed": 100,
}


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def upload(
    request: Request,
    files: list[UploadFile] = File(...),
    checklist_id: str = Form("hipaa"),
    current=Depends(get_current_user),
):
    if len(files) > settings.MAX_BATCH_FILES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Maximum {settings.MAX_BATCH_FILES} files per request",
        )

    document_ids: list[str] = []
    for upload_file in files:
        data = await upload_file.read()
        if len(data) > settings.MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"{upload_file.filename} exceeds the 50MB limit",
            )

        file_type = detect_file_type(data, upload_file.filename or "upload")
        if file_type is None:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"{upload_file.filename}: unsupported or spoofed file type",
            )

        doc_uuid = str(uuid.uuid4())
        original_name = upload_file.filename or f"{doc_uuid}.{file_type}"
        relative_path = f"documents/{doc_uuid}/{original_name}"
        storage_service.save_file(data, relative_path)

        now = utcnow()
        doc = {
            "filename": f"{doc_uuid}_{original_name}",
            "original_name": original_name,
            "file_path": relative_path,
            "file_type": file_type,
            "uploader_id": current["user_id"],
            "status": "pending",
            "checklist_id": checklist_id,
            "extracted_text": None,
            "classification": None,
            "confidence_score": None,
            "violations": [],
            "summary": None,
            "key_clauses": [],
            "risk_level": None,
            "risk_score": None,
            "ai_fix_suggestions": {},
            "created_at": now,
            "updated_at": now,
            "approval_status": "pending",
            "approved_by": None,
            "approved_at": None,
            "rejection_reason": None,
            "comments": [],
            "audit_report_path": None,
        }
        result = await db.documents.insert_one(doc)
        doc_id = str(result.inserted_id)
        document_ids.append(doc_id)

        await write_audit_log(
            user_id=current["user_id"], user_email=None, action="upload",
            document_id=doc_id, document_name=original_name,
            metadata={"checklist_id": checklist_id, "file_type": file_type},
            ip_address=request.client.host if request.client else None,
        )
        start_pipeline(doc_id)

    return UploadResponse(document_ids=document_ids, count=len(document_ids))


@router.get("/stats")
async def dashboard_stats(current=Depends(get_current_user)):
    """Counts for the dashboard stat cards."""
    today = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    total = await db.documents.count_documents({})
    pending = await db.documents.count_documents({"approval_status": "pending"})
    high_risk = await db.documents.count_documents({"risk_level": "High"})
    approved_today = await db.documents.count_documents({"approval_status": "approved", "approved_at": {"$gte": today}})
    critical = 0
    async for d in db.documents.find({}, {"violations": 1}):
        critical += sum(1 for v in d.get("violations", []) if v.get("severity") == "critical")
    return {
        "total_documents": total,
        "pending_review": pending,
        "critical_violations": critical,
        "high_risk": high_risk,
        "approved_today": approved_today,
    }


@router.get("", response_model=PaginatedDocuments)
async def list_documents(current=Depends(get_current_user), page: int = 1, limit: int = 20,
                         status: str | None = None, risk: str | None = None,
                         approval: str | None = None):
    query: dict = {}
    if status:
        query["status"] = status
    if approval:
        query["approval_status"] = approval
    if risk:
        query["risk_level"] = risk.capitalize() if risk.lower() in ("low", "medium", "high") else risk
    limit = min(max(limit, 1), 100)
    skip = max(page - 1, 0) * limit
    total = await db.documents.count_documents(query)
    cursor = db.documents.find(query).sort("created_at", -1).skip(skip).limit(limit)
    items = [serialize(d) async for d in cursor]
    return PaginatedDocuments(items=items, total=total, page=page, limit=limit)


async def _get_doc_or_404(document_id: str) -> dict:
    try:
        doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    except InvalidId:
        doc = None
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


@router.get("/{document_id}", response_model=DocumentDetail)
async def get_document(document_id: str, current=Depends(get_current_user)):
    return serialize(await _get_doc_or_404(document_id))


@router.get("/{document_id}/status", response_model=StatusResponse)
async def get_status(document_id: str, current=Depends(get_current_user)):
    doc = await _get_doc_or_404(document_id)
    return StatusResponse(
        id=str(doc["_id"]),
        status=doc["status"],
        classification=doc.get("classification"),
        confidence_score=doc.get("confidence_score"),
        progress_percent=_PROGRESS.get(doc["status"], 0),
    )


@router.get("/{document_id}/file")
async def get_file(document_id: str, current=Depends(get_current_user)):
    """Stream the original uploaded document (for the PDF viewer). Authenticated only."""
    doc = await _get_doc_or_404(document_id)
    try:
        abs_path = storage_service.get_file_path(doc["file_path"])
    except (FileNotFoundError, ValueError, KeyError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File missing")
    media = {"pdf": "application/pdf", "png": "image/png", "jpg": "image/jpeg",
             "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
    return FileResponse(path=str(abs_path), media_type=media.get(doc.get("file_type"), "application/octet-stream"),
                        filename=doc.get("original_name"))


async def _email_of(user_id: str) -> str | None:
    try:
        u = await db.users.find_one({"_id": ObjectId(user_id)}, {"email": 1})
        return u.get("email") if u else None
    except InvalidId:
        return None


@router.patch("/{document_id}/approve", response_model=DocumentDetail)
async def approve(document_id: str, request: Request, current=Depends(require_role("admin", "reviewer"))):
    doc = await _get_doc_or_404(document_id)
    email = await _email_of(current["user_id"])
    await db.documents.update_one({"_id": doc["_id"]}, {"$set": {
        "approval_status": "approved", "approved_by": email or current["user_id"],
        "approved_at": utcnow(), "rejection_reason": None, "updated_at": utcnow(),
    }})
    await write_audit_log(user_id=current["user_id"], user_email=email, action="approve",
                          document_id=document_id, document_name=doc.get("original_name"),
                          ip_address=request.client.host if request.client else None)
    await create_notification(user_id=doc["uploader_id"], document_id=document_id, ntype="approval",
                              message=f"{doc.get('original_name')} was approved")
    return serialize(await _get_doc_or_404(document_id))


@router.patch("/{document_id}/reject", response_model=DocumentDetail)
async def reject(document_id: str, body: RejectRequest, request: Request,
                 current=Depends(require_role("admin", "reviewer"))):
    doc = await _get_doc_or_404(document_id)
    email = await _email_of(current["user_id"])
    await db.documents.update_one({"_id": doc["_id"]}, {"$set": {
        "approval_status": "rejected", "approved_by": email or current["user_id"],
        "approved_at": utcnow(), "rejection_reason": body.reason, "updated_at": utcnow(),
    }})
    await write_audit_log(user_id=current["user_id"], user_email=email, action="reject",
                          document_id=document_id, document_name=doc.get("original_name"),
                          metadata={"reason": body.reason},
                          ip_address=request.client.host if request.client else None)
    await create_notification(user_id=doc["uploader_id"], document_id=document_id, ntype="rejection",
                              message=f"{doc.get('original_name')} was rejected: {body.reason}")
    return serialize(await _get_doc_or_404(document_id))


@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(document_id: str, request: Request, current=Depends(require_role("admin"))):
    doc = await _get_doc_or_404(document_id)
    # Remove stored files (original + any generated report), then the DB record.
    for rel in (doc.get("file_path"), doc.get("audit_report_path")):
        if rel:
            try:
                storage_service.delete_file(rel)
            except ValueError:
                pass
    await db.documents.delete_one({"_id": doc["_id"]})
    await write_audit_log(user_id=current["user_id"], user_email=None, action="delete",
                          document_id=document_id, document_name=doc.get("original_name"),
                          ip_address=request.client.host if request.client else None)
    return {"detail": "Document deleted"}
