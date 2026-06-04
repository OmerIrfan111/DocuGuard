"""Audit log viewing + CSV export (admin or auditor)."""
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from app.database import db
from app.dependencies import require_role
from app.utils.helpers import serialize

router = APIRouter(prefix="/api/audit-logs", tags=["audit-logs"])


def _build_query(user_id, action, frm, to) -> dict:
    query: dict = {}
    if user_id:
        query["user_id"] = user_id
    if action:
        query["action"] = action
    ts: dict = {}
    for key, value in (("$gte", frm), ("$lte", to)):
        if value:
            try:
                ts[key] = datetime.fromisoformat(value)
            except ValueError:
                pass
    if ts:
        query["timestamp"] = ts
    return query


@router.get("")
async def list_logs(current=Depends(require_role("admin", "auditor")),
                    page: int = 1, limit: int = 50,
                    user_id: str | None = None, action: str | None = None,
                    frm: str | None = Query(None, alias="from"), to: str | None = None):
    query = _build_query(user_id, action, frm, to)
    limit = min(max(limit, 1), 200)
    skip = max(page - 1, 0) * limit
    total = await db.audit_logs.count_documents(query)
    cursor = db.audit_logs.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    items = [serialize(x) async for x in cursor]
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/export")
async def export_logs(current=Depends(require_role("admin", "auditor")),
                      user_id: str | None = None, action: str | None = None,
                      frm: str | None = Query(None, alias="from"), to: str | None = None):
    query = _build_query(user_id, action, frm, to)

    async def rows():
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["timestamp", "user_email", "action", "document_name", "document_id", "ip_address"])
        yield buf.getvalue()
        async for x in db.audit_logs.find(query).sort("timestamp", -1):
            buf.seek(0); buf.truncate(0)
            writer.writerow([
                x.get("timestamp", ""), x.get("user_email", ""), x.get("action", ""),
                x.get("document_name", ""), x.get("document_id", ""), x.get("ip_address", ""),
            ])
            yield buf.getvalue()

    return StreamingResponse(rows(), media_type="text/csv",
                             headers={"Content-Disposition": "attachment; filename=audit_logs.csv"})
