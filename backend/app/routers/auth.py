"""Custom JWT auth: register, login, refresh, logout, me."""
from datetime import timedelta

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status

from app.config import settings
from app.database import db, redis_client
from app.dependencies import get_current_user, get_current_user_from_refresh
from app.models.user import UserRegister, UserLogin, UserPublic, TokenResponse
from app.utils.auth_utils import (
    hash_password, verify_password, create_access_token, create_refresh_token,
)
from app.utils.helpers import utcnow, serialize, write_audit_log

router = APIRouter(prefix="/api/auth", tags=["auth"])

REFRESH_COOKIE = "refresh_token"
REFRESH_MAX_AGE = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 24 * 3600


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=REFRESH_MAX_AGE,
        path="/api/auth",
    )


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserPublic)
async def register(payload: UserRegister, request: Request):
    existing = await db.users.find_one({"email": payload.email.lower()})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user_doc = {
        "email": payload.email.lower(),
        "hashed_password": hash_password(payload.password),
        "full_name": payload.full_name,
        "role": "reviewer",  # default role
        "is_active": True,
        "created_at": utcnow(),
        "last_login": None,
    }
    result = await db.users.insert_one(user_doc)
    user_doc["_id"] = result.inserted_id

    await write_audit_log(
        user_id=str(result.inserted_id), user_email=user_doc["email"],
        action="register", ip_address=request.client.host if request.client else None,
    )
    return serialize(user_doc)


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, response: Response, request: Request):
    user = await db.users.find_one({"email": payload.email.lower()})
    if not user or not verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    user_id = str(user["_id"])
    access = create_access_token(user_id, user["role"])
    refresh, _jti = create_refresh_token(user_id)
    _set_refresh_cookie(response, refresh)

    await db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login": utcnow()}})
    await write_audit_log(
        user_id=user_id, user_email=user["email"], action="login",
        ip_address=request.client.host if request.client else None,
    )
    return TokenResponse(access_token=access)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(current=Depends(get_current_user_from_refresh)):
    try:
        user = await db.users.find_one({"_id": ObjectId(current["user_id"])})
    except InvalidId:
        user = None
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User no longer valid")
    access = create_access_token(str(user["_id"]), user["role"])
    return TokenResponse(access_token=access)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(response: Response, current=Depends(get_current_user_from_refresh)):
    jti = current.get("jti")
    if jti:
        # Blacklist the refresh token JTI for the remainder of its lifetime.
        redis_client.setex(f"blacklist:{jti}", REFRESH_MAX_AGE, "1")
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")
    await write_audit_log(user_id=current["user_id"], user_email=None, action="logout")
    return {"detail": "Logged out"}


@router.get("/me", response_model=UserPublic)
async def me(current=Depends(get_current_user)):
    try:
        user = await db.users.find_one({"_id": ObjectId(current["user_id"])})
    except InvalidId:
        user = None
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return serialize(user)
