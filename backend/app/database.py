"""Motor (async MongoDB) and Redis clients + index bootstrap.

Redis is used both as the Celery broker (by Celery directly via REDIS_URL) and as the
JWT refresh-token blacklist store (key namespace ``blacklist:<jti>``).
"""
import motor.motor_asyncio
import redis

from app.config import settings

# ── MongoDB (Motor, async) ────────────────────────────────────────
mongo_client = motor.motor_asyncio.AsyncIOMotorClient(settings.MONGODB_URI)
db = mongo_client[settings.MONGODB_DB_NAME]

# ── Redis (sync client — used for the JWT blacklist) ──────────────
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)


async def create_indexes() -> None:
    """Create all collection indexes (idempotent)."""
    await db.users.create_index("email", unique=True)
    await db.documents.create_index("uploader_id")
    await db.documents.create_index("status")
    await db.documents.create_index("checklist_id")
    await db.checklists.create_index("slug", unique=True)
    await db.audit_logs.create_index("timestamp")
    await db.audit_logs.create_index("user_id")
    await db.notifications.create_index("user_id")
    await db.notifications.create_index("read")


async def connect_to_mongo() -> None:
    """Verify connectivity and ensure indexes exist (called on startup)."""
    await mongo_client.admin.command("ping")
    await create_indexes()


async def close_mongo_connection() -> None:
    mongo_client.close()


async def ping_services() -> dict:
    """Health-check helper for /api/health."""
    status = {"mongodb": False, "redis": False}
    try:
        await mongo_client.admin.command("ping")
        status["mongodb"] = True
    except Exception:
        status["mongodb"] = False
    try:
        status["redis"] = bool(redis_client.ping())
    except Exception:
        status["redis"] = False
    return status
