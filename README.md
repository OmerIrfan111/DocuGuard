# DocuGuard

DocuGuard is a full-stack platform that automates document compliance review. It ingests PDFs,
Word documents, and images; extracts their text with OCR and NLP; classifies the document type;
validates the content against regulatory frameworks (HIPAA, GDPR, SOC 2, PCI-DSS); detects
violations with their exact locations; uses AWS Bedrock (Claude) to generate fix suggestions and
summaries; scores risk; and produces downloadable audit reports — all through a secure,
role-based web dashboard.

## Features

- **Document upload** — PDF, DOCX, PNG, JPG with magic-byte type validation (50 MB / 10 files per request)
- **Text extraction** — Tesseract OCR with AWS Textract fallback, Apache Tika for PDFs, python-docx for Word
- **Classification** — rule-based document typing with an AWS Bedrock fallback
- **Compliance engine** — four detection types (regex pattern, required keyword, forbidden keyword,
  spaCy NLP entity) with character-precise violation offsets and 0–100 risk scoring (Low / Medium / High)
- **Built-in checklists** — HIPAA, GDPR, SOC 2, PCI-DSS, plus a builder for custom checklists
- **AI assistance** — per-violation fix suggestions and plain-language document summaries via AWS Bedrock (Claude)
- **Review workflow** — approve/reject with reasons, status tracking, and a full audit trail
- **Audit reports** — downloadable in PDF and DOCX
- **Access control** — role-based permissions for admin, reviewer, and auditor
- **Notifications & logging** — in-app notifications and activity logs with CSV export
- **Security** — custom JWT auth (bcrypt, refresh-token rotation, Redis blacklist), AES-256 field
  encryption, rate limiting, hardened security headers, and CORS whitelisting

## Tech stack

- **Frontend:** React (Vite), Tailwind CSS, React Router, Axios, Framer Motion
- **Backend:** FastAPI, Celery, Motor (async MongoDB)
- **Data:** MongoDB, Redis
- **AI / OCR:** AWS Bedrock (Claude), AWS Textract, Tesseract, Apache Tika, spaCy
- **Infrastructure:** Docker Compose

## Getting started

**Prerequisites:** Docker and Docker Compose.

**1. Configure environment**
```bash
cp backend/.env.example backend/.env
```
Generate a JWT secret and a Fernet encryption key, and paste them into `backend/.env`:
```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```
For AI features, add an AWS Bedrock API key (`AWS_BEARER_TOKEN_BEDROCK`) and enable model access
in the AWS console. Without it, the app runs and degrades gracefully (rule-based and local OCR paths).

**2. Start the stack**
```bash
docker compose up --build
```
- Web app: http://localhost:5173
- API (Swagger docs): http://localhost:8000/docs

**3. Create the first admin**
```bash
docker compose exec api python -m app.scripts.seed_admin \
  --email admin@example.com --password "ChangeMe123!" --name Admin
```
Self-registered users receive the `reviewer` role by default.

## Project structure

```
backend/   FastAPI app — config, database, auth, routers, services, Celery tasks, checklists, tests
frontend/  React + Vite app — pages, components, hooks, API client
docker-compose.yml   api, worker, redis, mongo, frontend
```

## Roles

| Role | Access |
|---|---|
| `admin` | Full access: users, documents, checklists, and all data |
| `reviewer` | Upload, review, approve/reject, and download reports |
| `auditor` | Read-only access to documents, violations, and audit logs |

## API overview

```
Auth          /api/auth/{register,login,refresh,logout,me,password}
Documents     /api/documents (upload, list, get, status, approve, reject, delete, file, stats)
Compliance    /api/compliance/{checklists, validate/:id}
Reports       /api/reports/{generate/:id, :id/download}
Users         /api/users (admin)
Audit logs    /api/audit-logs (+ /export)
Notifications /api/notifications
```
