"""Audit report generation + authenticated local download (no S3)."""
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import FileResponse

from app.database import db
from app.dependencies import get_current_user, require_role
from app.services import checklist_service, report_service, storage_service
from app.utils.helpers import write_audit_log

router = APIRouter(prefix="/api/reports", tags=["reports"])

_MEDIA = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


async def _document_or_404(document_id: str) -> dict:
    try:
        doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    except InvalidId:
        doc = None
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")
    return doc


async def _resolve_checklist(slug: str | None) -> dict:
    builtin = checklist_service.load_builtin(slug) if slug else None
    if builtin:
        return builtin
    if slug:
        custom = await db.checklists.find_one({"slug": slug})
        if custom:
            return custom
    return {"rules": []}


@router.post("/generate/{document_id}", status_code=status.HTTP_201_CREATED)
async def generate(document_id: str, request: Request,
                   fmt: str = Query("pdf", alias="format", pattern="^(pdf|docx)$"),
                   current=Depends(require_role("admin", "reviewer"))):
    doc = await _document_or_404(document_id)
    checklist = await _resolve_checklist(doc.get("checklist_id"))

    data = report_service.generate_report(doc, checklist, fmt)
    ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    relative_path = f"reports/{document_id}/audit_report_{ts}.{fmt}"
    storage_service.save_file(data, relative_path)

    await db.documents.update_one({"_id": doc["_id"]}, {"$set": {"audit_report_path": relative_path}})
    await write_audit_log(
        user_id=current["user_id"], user_email=None, action="download_report",
        document_id=document_id, document_name=doc.get("original_name"),
        metadata={"format": fmt}, ip_address=request.client.host if request.client else None,
    )
    return {
        "detail": "Report generated",
        "format": fmt,
        "filename": relative_path.split("/")[-1],
        "download_url": f"/api/reports/{document_id}/download",
    }


@router.get("/{document_id}/download")
async def download(document_id: str, current=Depends(get_current_user)):
    doc = await _document_or_404(document_id)
    rel = doc.get("audit_report_path")
    if not rel:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No report generated yet")
    try:
        abs_path = storage_service.get_file_path(rel)
    except (FileNotFoundError, ValueError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report file missing")
    ext = rel.rsplit(".", 1)[-1]
    return FileResponse(path=str(abs_path), media_type=_MEDIA.get(ext, "application/octet-stream"),
                        filename=rel.split("/")[-1])
