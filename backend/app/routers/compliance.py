"""Compliance checklist CRUD + document re-validation trigger."""
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.database import db
from app.dependencies import get_current_user, require_role
from app.models.checklist import ChecklistCreate, ChecklistUpdate, ChecklistPublic
from app.services import checklist_service
from app.tasks.document_tasks import start_revalidation
from app.utils.helpers import utcnow, write_audit_log

router = APIRouter(prefix="/api/compliance", tags=["compliance"])


def _to_public(doc: dict, is_builtin: bool) -> ChecklistPublic:
    rules = doc.get("rules", [])
    return ChecklistPublic(
        slug=doc["slug"], name=doc["name"], version=doc.get("version", "1.0"),
        is_builtin=is_builtin, rule_count=len(rules), rules=rules,
    )


async def _custom_checklist(slug: str) -> dict | None:
    return await db.checklists.find_one({"slug": slug})


@router.get("/checklists", response_model=list[ChecklistPublic])
async def list_checklists(current=Depends(get_current_user)):
    out = [_to_public(c, True) for c in checklist_service.load_all_builtin() if c]
    async for c in db.checklists.find():
        out.append(_to_public(c, False))
    # Summary view — drop full rule bodies to keep the list light.
    for c in out:
        c.rules = []
    return out


@router.get("/checklists/{slug}", response_model=ChecklistPublic)
async def get_checklist(slug: str, current=Depends(get_current_user)):
    builtin = checklist_service.load_builtin(slug)
    if builtin:
        return _to_public(builtin, True)
    custom = await _custom_checklist(slug)
    if custom:
        return _to_public(custom, False)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found")


@router.post("/checklists", response_model=ChecklistPublic, status_code=status.HTTP_201_CREATED)
async def create_checklist(payload: ChecklistCreate, request: Request,
                           current=Depends(require_role("admin", "reviewer"))):
    if checklist_service.load_builtin(payload.slug) or await _custom_checklist(payload.slug):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Checklist slug already exists")

    doc = {
        "name": payload.name,
        "slug": payload.slug,
        "version": payload.version,
        "is_builtin": False,
        "created_by": current["user_id"],
        "created_at": utcnow(),
        "rules": [r.model_dump() for r in payload.rules],
    }
    await db.checklists.insert_one(doc)
    await write_audit_log(user_id=current["user_id"], user_email=None, action="create_checklist",
                          metadata={"slug": payload.slug},
                          ip_address=request.client.host if request.client else None)
    return _to_public(doc, False)


@router.put("/checklists/{slug}", response_model=ChecklistPublic)
async def update_checklist(slug: str, payload: ChecklistUpdate,
                           current=Depends(require_role("admin", "reviewer"))):
    if checklist_service.load_builtin(slug):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Built-in checklists are read-only")
    custom = await _custom_checklist(slug)
    if not custom:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found")

    update = {}
    if payload.name is not None:
        update["name"] = payload.name
    if payload.version is not None:
        update["version"] = payload.version
    if payload.rules is not None:
        update["rules"] = [r.model_dump() for r in payload.rules]
    if update:
        await db.checklists.update_one({"slug": slug}, {"$set": update})
    return _to_public(await _custom_checklist(slug), False)


@router.delete("/checklists/{slug}", status_code=status.HTTP_200_OK)
async def delete_checklist(slug: str, current=Depends(require_role("admin"))):
    if checklist_service.load_builtin(slug):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Built-in checklists cannot be deleted")
    result = await db.checklists.delete_one({"slug": slug})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found")
    return {"detail": "Checklist deleted"}


class ValidateRequest(BaseModel):
    checklist_id: str | None = None


@router.post("/validate/{document_id}", status_code=status.HTTP_202_ACCEPTED)
async def revalidate(document_id: str, body: ValidateRequest | None = None,
                     current=Depends(require_role("admin", "reviewer"))):
    try:
        doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    except InvalidId:
        doc = None
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if body and body.checklist_id:
        # Confirm the requested checklist exists (builtin or custom) before switching.
        if not checklist_service.load_builtin(body.checklist_id) and not await _custom_checklist(body.checklist_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target checklist not found")
        await db.documents.update_one({"_id": doc["_id"]}, {"$set": {"checklist_id": body.checklist_id}})

    start_revalidation(document_id)
    return {"detail": "Re-validation started", "document_id": document_id}
