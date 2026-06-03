"""DocuGuard FastAPI application entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import connect_to_mongo, close_mongo_connection, ping_services
from app.routers import auth, documents, compliance


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """Baseline security headers (hardened further in Phase 5)."""
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


@app.get("/api/health", tags=["health"])
async def health():
    services = await ping_services()
    ok = all(services.values())
    return {"status": "ok" if ok else "degraded", "services": services}


app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(compliance.router)
