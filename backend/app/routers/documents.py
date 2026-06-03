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
from app.dependencies import get_current_user
from app.models.document import UploadResponse, StatusResponse, DocumentPublic, DocumentDetail
from app.services import storage_service
from app.services.file_validation import detect_file_type
from app.tasks.document_tasks import start_pipeline
from app.utils.helpers import utcnow, serialize, write_audit_log

router = APIRouter(prefix="/api/documents", tags=["documents"])

_PROGRESS = {
    "pending": 5, "extracting": 25, "classifying": 50,
    "validating": 75, "completed": 100, "failed": 100,
}


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
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


@router.get("", response_model=list[DocumentPublic])
async def list_documents(current=Depends(get_current_user), page: int = 1, limit: int = 20):
    skip = max(page - 1, 0) * limit
    cursor = db.documents.find().sort("created_at", -1).skip(skip).limit(min(limit, 100))
    return [serialize(d) async for d in cursor]


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
