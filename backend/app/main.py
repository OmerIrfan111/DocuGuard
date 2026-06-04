"""DocuGuard FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, ping_services
from app.rate_limit import limiter
from app.routers import (
    auth, documents, compliance, reports, users, audit_logs, notifications,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title="DocuGuard API",
    version="1.0.0",
    description="Document Intelligence & Compliance Automation",
    lifespan=lifespan,
)

# Rate limiting (slowapi) — limiter is attached to app state; limits are applied as
# decorators on abuse-prone endpoints (upload, validate).
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,  # whitelist only — never "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Security headers applied to every response."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    if settings.ENVIRONMENT.lower() == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    return response


@app.get("/api/health", tags=["health"])
async def health():
    services = await ping_services()
    ok = all(services.values())
    return {"status": "ok" if ok else "degraded", "services": services}


app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(compliance.router)
app.include_router(reports.router)
app.include_router(users.router)
app.include_router(audit_logs.router)
app.include_router(notifications.router)
