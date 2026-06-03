# DocuGuard

AI-powered **Document Intelligence & Compliance Automation**. Upload documents (PDF / DOCX /
images); DocuGuard extracts text (OCR + NLP), classifies them, validates against compliance
frameworks (HIPAA, GDPR, SOC 2, PCI-DSS), flags violations, uses AWS Bedrock (Claude 3.5 Sonnet)
for fix suggestions and summaries, scores risk, and produces downloadable audit reports — all
behind a role-based dashboard.

> Authoritative spec: [`PROMPT (1).md`](./PROMPT%20(1).md) · Phased plan:
> `DocuGuard-Development-Plan.docx` · Working context for Claude: [`CLAUDE.md`](./CLAUDE.md)

## Architecture
- **Frontend:** React (Vite) + Tailwind, Axios with JWT auto-refresh interceptor.
- **Backend:** FastAPI + Celery/Redis, Motor (async MongoDB).
- **Auth:** custom JWT (access in memory, refresh in httpOnly cookie) + bcrypt (cost 12).
- **Storage:** **local filesystem** under `./storage`, served only via authenticated endpoints
  (no S3). `extracted_text` is AES-256 Fernet encrypted at rest.
- **AI/OCR:** AWS Bedrock + Textract; Tesseract local OCR; Apache Tika for PDF/DOCX.

## Prerequisites
- Docker + Docker Compose.
- An AWS account with Textract + Bedrock enabled (Bedrock model access for
  `anthropic.claude-3-5-sonnet-20241022-v2:0`). Required from Phase 2 onward — Phase 1 runs
  without AWS.

## Quick start
```bash
# 1. Configure backend env
cp backend/.env.example backend/.env

# 2. Generate secrets and paste them into backend/.env
python -c "import secrets; print(secrets.token_urlsafe(48))"                         # JWT_SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # FIELD_ENCRYPTION_KEY

# 3. Launch the full stack
docker compose up --build
```
- API: http://localhost:8000  (Swagger UI at `/docs`, health at `/api/health`)
- Frontend: http://localhost:5173

### Seed the first admin
```bash
docker compose exec api python -m app.scripts.seed_admin \
  --email admin@docuguard.local --password 'ChangeMe123!' --name 'Admin'
```
(New self-registrations default to the `reviewer` role.)

## Project status — Phase 1 (Foundation) complete
Implemented:
- Custom JWT auth: `register`, `login`, `refresh`, `logout`, `me` (+ Redis blacklist on logout).
- Local filesystem storage service with path-traversal protection.
- Document upload endpoint with magic-byte validation, size/batch limits, MongoDB record.
- MongoDB collections + indexes; Motor + Redis clients with health check.
- Celery app + chained pipeline skeleton (extract → classify → validate → summarise → notify).
- React auth flow: AuthContext, protected routes, Axios 401→refresh→retry, Login/Register/Dashboard.

Next: **Phase 2 — Document Processing Pipeline** (OCR, extraction, classification). See the
dev-plan QA gate (§1.4) before proceeding.

## Repo layout
```
backend/    FastAPI app (app/{config,database,dependencies,models,routers,services,tasks,utils,scripts})
frontend/   React + Vite app (src/{api,context,hooks,components,pages})
docker-compose.yml   api + worker + redis + mongo + frontend
```

## Roles
| Role | Permissions |
|---|---|
| `admin` | Everything: users, delete docs, manage checklists, view all |
| `reviewer` | Upload, review, annotate, approve/reject, download reports |
| `auditor` | Read-only: documents, violations, audit logs |
