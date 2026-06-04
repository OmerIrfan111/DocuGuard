"""User administration (admin only)."""
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.database import db
from app.dependencies import require_role
from app.models.user import UserPublic, Role
from app.utils.helpers import serialize, write_audit_log

router = APIRouter(prefix="/api/users", tags=["users"])


class RoleUpdate(BaseModel):
    role: Role


class ActiveUpdate(BaseModel):
    is_active: bool


async def _user_or_404(user_id: str) -> dict:
    try:
        u = await db.users.find_one({"_id": ObjectId(user_id)})
    except InvalidId:
        u = None
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return u


@router.get("", response_model=list[UserPublic])
async def list_users(current=Depends(require_role("admin"))):
    return [serialize(u) async for u in db.users.find().sort("created_at", -1)]


@router.patch("/{user_id}/role", response_model=UserPublic)
async def update_role(user_id: str, body: RoleUpdate, request: Request,
                      current=Depends(require_role("admin"))):
    await _user_or_404(user_id)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"role": body.role}})
    await write_audit_log(user_id=current["user_id"], user_email=None, action="update_role",
                          metadata={"target": user_id, "role": body.role},
                          ip_address=request.client.host if request.client else None)
    return serialize(await _user_or_404(user_id))


@router.patch("/{user_id}/deactivate", response_model=UserPublic)
async def set_active(user_id: str, body: ActiveUpdate, request: Request,
                     current=Depends(require_role("admin"))):
    await _user_or_404(user_id)
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": body.is_active}})
    await write_audit_log(user_id=current["user_id"], user_email=None,
                          action="activate" if body.is_active else "deactivate",
                          metadata={"target": user_id},
                          ip_address=request.client.host if request.client else None)
    return serialize(await _user_or_404(user_id))
