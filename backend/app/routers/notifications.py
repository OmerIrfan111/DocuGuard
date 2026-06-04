"""In-app notifications for the current user."""
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from app.database import db
from app.dependencies import get_current_user
from app.utils.helpers import serialize

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("")
async def list_notifications(current=Depends(get_current_user), limit: int = 10):
    uid = current["user_id"]
    cursor = db.notifications.find({"user_id": uid}).sort("created_at", -1).limit(min(limit, 50))
    items = [serialize(n) async for n in cursor]
    unread = await db.notifications.count_documents({"user_id": uid, "read": False})
    return {"items": items, "unread_count": unread}


@router.patch("/{notification_id}/read")
async def mark_read(notification_id: str, current=Depends(get_current_user)):
    try:
        oid = ObjectId(notification_id)
    except InvalidId:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    result = await db.notifications.update_one(
        {"_id": oid, "user_id": current["user_id"]}, {"$set": {"read": True}})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return {"detail": "marked read"}


@router.patch("/read-all")
async def mark_all_read(current=Depends(get_current_user)):
    result = await db.notifications.update_many(
        {"user_id": current["user_id"], "read": False}, {"$set": {"read": True}})
    return {"detail": "all marked read", "updated": result.modified_count}