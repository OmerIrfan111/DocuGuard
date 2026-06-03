# PROMPT.md — Document Intelligence & Compliance Automation System

> Hand this file directly to Claude Code.
> No Firebase. No OpenAI. One AWS account (Textract + Bedrock). Local filesystem storage. Custom JWT auth with bcrypt.

---

## Project Overview

Build a full-stack AI-powered Document Intelligence and Compliance Automation System. The system reads uploaded documents (PDF, DOCX, images), extracts structured data via OCR and NLP, validates content against compliance frameworks (HIPAA, GDPR, SOC 2, PCI-DSS), detects violations, generates AI-powered fix suggestions via AWS Bedrock (Claude 3.5 Sonnet), and produces downloadable audit reports. A secure role-based dashboard allows managers, reviewers, and auditors to upload, annotate, approve, or reject documents.

**Auth: Custom JWT (FastAPI + python-jose + bcrypt)** — no external auth provider. Users stored in MongoDB.
**AI: AWS Bedrock (Claude 3.5 Sonnet)** — summarization, fix suggestions, classification fallback.
**Storage: Local filesystem** — all file uploads stored on disk, served through authenticated download endpoints.
**OCR: Tesseract (local) → AWS Textract (fallback).**
**One AWS account covers Textract + Bedrock.**

---

## Tech Stack

### Frontend
- React.js (Vite)
- Tailwind CSS
- React Router v6
- Axios (with JWT interceptor for token refresh)
- React Dropzone
- @react-pdf-viewer/core + pdfjs-dist
- React Toastify
- Framer Motion

### Backend
- Python FastAPI
- Celery + Redis (async task queue)
- Motor (async MongoDB driver)
- Apache Tika (PDF/DOCX text extraction)
- pytesseract + Pillow (OCR)
- python-magic (file type validation via magic bytes)
- spaCy en_core_web_sm (NLP entity extraction)
- boto3 (Textract + Bedrock)
- python-jose (JWT encode/decode)
- passlib[bcrypt] (password hashing)
- reportlab (PDF report generation)
- python-docx (DOCX report generation)
- slowapi (rate limiting)
- cryptography (AES-256 field encryption)
- aiofiles, python-multipart, python-dotenv

### Database
- MongoDB Atlas (all collections)
- Redis (Celery broker + JWT token blacklist)

### Cloud
- Local filesystem storage (document + report storage)
- AWS Textract (high-accuracy OCR fallback)
- AWS Bedrock — Claude 3.5 Sonnet (all AI inference)

---

## Services & Credentials Needed

### 1. AWS (one IAM user, two services)
```env
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_REGION=us-east-1

# Local storage
LOCAL_STORAGE_DIR=./storage
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_REGION=us-east-1
```
IAM policies to attach: `AmazonTextractFullAccess`, `AmazonBedrockFullAccess`
After creating IAM user: go to AWS Console → Bedrock → Model Access → enable `anthropic.claude-3-5-sonnet-20241022-v2:0`

### 2. MongoDB Atlas
```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/docuguard
```

### 3. Redis (no key — run via Docker locally)
```env
REDIS_URL=redis://redis:6379/0
```

**Total external services: 2 (AWS + MongoDB). No Firebase. No OpenAI.**

---

## Auth System — Custom JWT with bcrypt

### How It Works (end to end)

1. **Register**: User submits email + password → backend hashes password with bcrypt (cost factor 12) → stores user record in MongoDB → returns success
2. **Login**: User submits email + password → backend finds user by email → bcrypt verifies password against stored hash → generates JWT access token (1hr) + refresh token (7 days) → returns both
3. **API requests**: Frontend sends `Authorization: Bearer <access_token>` header → FastAPI dependency decodes and verifies JWT → extracts user ID and role → proceeds or returns 401
4. **Token refresh**: Axios interceptor catches 401 → sends refresh token to `/api/auth/refresh` → gets new access token → retries original request transparently
5. **Logout**: Refresh token JTI (unique token ID) stored in Redis blacklist with TTL → future refresh attempts rejected

### Why bcrypt for passwords
Passwords are never stored in plain text. bcrypt hashes them into an irreversible scrambled string. Even if the database is breached, attackers only get the hash — not the real password. bcrypt is deliberately slow (configurable cost factor), making brute-force attacks impractical. Cost factor 12 means ~250ms per hash attempt, fast enough for login but too slow to crack at scale.

### Token Storage on Frontend
- **Access token**: stored in React state / memory only (never localStorage — XSS risk)
- **Refresh token**: stored in httpOnly cookie (inaccessible to JavaScript — XSS safe)
- On page refresh: frontend calls `/api/auth/refresh` on load to restore session

### User Schema (MongoDB `users` collection)
```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "hashed_password": "$2b$12$...",
  "full_name": "John Smith",
  "role": "admin | reviewer | auditor",
  "is_active": true,
  "created_at": "ISO timestamp",
  "last_login": "ISO timestamp"
}
```

### Auth Implementation

**auth_utils.py**
```python
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
import uuid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain_password: str) -> str:
    return pwd_context.hash(plain_password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "type": "access",
        "exp": datetime.utcnow() + timedelta(minutes=60)
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> tuple[str, str]:
    jti = str(uuid.uuid4())  # unique token ID for blacklisting
    payload = {
        "sub": user_id,
        "jti": jti,
        "type": "refresh",
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return token, jti

def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
```

**dependencies.py**
```python
from fastapi import Depends, HTTPException, Cookie
from fastapi.security import OAuth2PasswordBearer
from app.utils.auth_utils import decode_token
from app.database import redis_client

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        return {"user_id": payload["sub"], "role": payload["role"]}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

def require_role(*roles):
    async def checker(current_user=Depends(get_current_user)):
        if current_user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user
    return checker

async def get_current_user_from_refresh(refresh_token: str = Cookie(None)):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        jti = payload.get("jti")
        # Check blacklist
        if redis_client.get(f"blacklist:{jti}"):
            raise HTTPException(status_code=401, detail="Token has been revoked")
        return {"user_id": payload["sub"], "jti": jti}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
```

**routers/auth.py — all 5 auth endpoints**
```python
POST /api/auth/register    # validate email unique → hash password → save user → return 201
POST /api/auth/login       # verify password → create tokens → set refresh cookie → return access token
POST /api/auth/refresh     # verify refresh token via cookie → check not blacklisted → return new access token
POST /api/auth/logout      # blacklist refresh token JTI in Redis (TTL 7 days) → clear cookie
GET  /api/auth/me          # return current user profile (no password hash)
```

**Frontend AuthContext.jsx**
```javascript
// Stores access token in memory (React state), refresh token in httpOnly cookie
// On app load: call /api/auth/refresh to restore session if cookie exists
// Axios interceptor: on 401, try refresh → retry request → if refresh fails → logout
const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session on page load
    refreshSession();
  }, []);

  const refreshSession = async () => { ... };
  const login = async (email, password) => { ... };
  const logout = async () => { ... };

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, isAuthenticated: !!user }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
```

---

## AWS Bedrock Integration

### bedrock_service.py
```python
import boto3
import json
from app.config import settings

bedrock = boto3.client(
    service_name="bedrock-runtime",
    region_name=settings.BEDROCK_REGION,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
)

def call_bedrock(prompt: str, max_tokens: int = 1500) -> str:
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}]
    })
    response = bedrock.invoke_model(
        modelId=settings.BEDROCK_MODEL_ID,
        body=body,
        contentType="application/json",
        accept="application/json"
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


def summarize_document(extracted_text: str) -> dict:
    prompt = f"""You are a compliance document expert. Analyze the following document and respond ONLY with a valid JSON object, no markdown, no explanation:
{{
  "summary": "3-sentence plain-language summary",
  "key_clauses": ["clause 1", "clause 2", "clause 3"],
  "risk_level": "Low | Medium | High",
  "document_purpose": "one sentence describing what this document is for"
}}

Document:
{extracted_text[:6000]}"""
    try:
        return json.loads(call_bedrock(prompt))
    except Exception:
        return {"summary": "Unavailable", "key_clauses": [], "risk_level": "Unknown", "document_purpose": "Unknown"}


def get_ai_fix_suggestion(rule_description: str, matched_text: str, context: str) -> str:
    prompt = f"""You are a compliance expert. A document has violated a compliance rule.

Rule: {rule_description}
Problematic text: "{matched_text}"
Context: "{context}"

Give a specific, actionable fix in 2-3 sentences. Be concrete. Plain text only, no markdown."""
    try:
        return call_bedrock(prompt, max_tokens=300)
    except Exception:
        return "Manual review required."


def classify_document_with_ai(extracted_text: str) -> dict:
    prompt = f"""Classify this document. Respond ONLY with valid JSON, no markdown:
{{
  "document_type": "one of: Medical Record, Consent Form, Legal Contract, Invoice, Privacy Policy, Audit Report, Employment Agreement, Insurance Policy, Procurement Document, Unknown",
  "confidence": 0.0,
  "reasoning": "one sentence"
}}

Document (first 3000 chars):
{extracted_text[:3000]}"""
    try:
        return json.loads(call_bedrock(prompt, max_tokens=200))
    except Exception:
        return {"document_type": "Unknown", "confidence": 0.0, "reasoning": "Failed"}
```

---

## Project Structure

```
docuguard/
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   ├── axiosInstance.js       # Axios with JWT interceptor + auto-refresh
│   │   │   ├── auth.js
│   │   │   ├── documents.js
│   │   │   ├── compliance.js
│   │   │   ├── reports.js
│   │   │   └── notifications.js
│   │   ├── components/
│   │   │   ├── AnnotationViewer.jsx
│   │   │   ├── DocumentCard.jsx
│   │   │   ├── FileUploader.jsx
│   │   │   ├── ViolationPanel.jsx
│   │   │   ├── ChecklistSelector.jsx
│   │   │   ├── RiskBadge.jsx
│   │   │   ├── RiskMeter.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Upload.jsx
│   │   │   ├── DocumentReview.jsx
│   │   │   ├── AuditLogs.jsx
│   │   │   ├── ChecklistBuilder.jsx
│   │   │   ├── AdminUsers.jsx
│   │   │   └── Settings.jsx
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── DocumentContext.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   └── useDocumentStatus.js   # polls status every 5s
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py                  # All settings from .env
│   │   ├── database.py                # Motor + Redis clients
│   │   ├── dependencies.py            # JWT auth dependencies
│   │   ├── models/
│   │   │   ├── document.py
│   │   │   ├── user.py
│   │   │   ├── checklist.py
│   │   │   ├── violation.py
│   │   │   └── audit_log.py
│   │   ├── routers/
│   │   │   ├── auth.py                # register, login, refresh, logout, me
│   │   │   ├── documents.py
│   │   │   ├── compliance.py
│   │   │   ├── checklists.py
│   │   │   ├── reports.py
│   │   │   └── users.py
│   │   ├── services/
│   │   │   ├── ocr_service.py
│   │   │   ├── parser_service.py
│   │   │   ├── nlp_service.py
│   │   │   ├── classifier_service.py
│   │   │   ├── compliance_engine.py
│   │   │   ├── bedrock_service.py
│   │   │   ├── storage_service.py
│   │   │   ├── report_service.py
│   │   │   └── notification_service.py
│   │   ├── tasks/
│   │   │   ├── celery_app.py
│   │   │   ├── document_tasks.py
│   │   │   └── report_tasks.py
│   │   ├── checklists/
│   │   │   ├── hipaa.json
│   │   │   ├── gdpr.json
│   │   │   ├── soc2.json
│   │   │   ├── pci_dss.json
│   │   │   └── internal_audit.json
│   │   └── utils/
│   │       ├── auth_utils.py          # hash_password, verify_password, create/decode tokens
│   │       ├── encryption.py          # AES-256 Fernet field encryption
│   │       └── helpers.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env
│
├── docker-compose.yml
└── README.md
```

---

## Environment Variables

### Backend `.env`
```env
# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/docuguard

# Redis
REDIS_URL=redis://redis:6379/0

# AWS — covers Textract and Bedrock
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# Local storage
LOCAL_STORAGE_DIR=./storage

# Bedrock
BEDROCK_MODEL_ID=anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_REGION=us-east-1

# JWT — no Firebase, no external auth
JWT_SECRET_KEY=minimum_32_character_random_string_here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# App
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:5173

# Encryption key for sensitive DB fields (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
FIELD_ENCRYPTION_KEY=your_fernet_key_here
```

### Frontend `.env`
```env
VITE_API_BASE_URL=http://localhost:8000/api
```

---

## MongoDB Collections

### `users`
```json
{
  "_id": "ObjectId",
  "email": "user@example.com",
  "hashed_password": "$2b$12$...",
  "full_name": "John Smith",
  "role": "admin | reviewer | auditor",
  "is_active": true,
  "created_at": "ISO timestamp",
  "last_login": "ISO timestamp"
}
```

### `documents`
```json
{
  "_id": "ObjectId",
  "filename": "uuid_contract.pdf",
  "original_name": "contract.pdf",
  "file_path": "storage/documents/uuid/contract.pdf",
  "file_type": "pdf",
  "uploader_id": "ObjectId",
  "status": "pending | extracting | classifying | validating | completed | failed",
  "checklist_id": "hipaa",
  "extracted_text": "encrypted_fernet_string",
  "classification": "Legal Contract",
  "confidence_score": 0.92,
  "violations": [],
  "summary": "...",
  "key_clauses": [],
  "risk_level": "High",
  "risk_score": 75,
  "ai_fix_suggestions": {},
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp",
  "approval_status": "pending | approved | rejected",
  "approved_by": "ObjectId",
  "approved_at": "ISO timestamp",
  "rejection_reason": null,
  "comments": [],
  "audit_report_path": null
}
```

### `checklists`
```json
{
  "_id": "ObjectId",
  "name": "HIPAA",
  "slug": "hipaa",
  "version": "2024",
  "is_builtin": true,
  "created_by": "ObjectId",
  "rules": []
}
```

### `audit_logs`
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "user_email": "user@example.com",
  "action": "upload | extract | classify | validate | approve | reject | download_report | login | logout | create_checklist",
  "document_id": "ObjectId",
  "document_name": "contract.pdf",
  "metadata": {},
  "ip_address": "127.0.0.1",
  "timestamp": "ISO timestamp"
}
```

### `notifications`
```json
{
  "_id": "ObjectId",
  "user_id": "ObjectId",
  "message": "contract.pdf has been approved",
  "document_id": "ObjectId",
  "type": "approval | rejection | upload | violation",
  "read": false,
  "created_at": "ISO timestamp"
}
```

---

## Celery Document Processing Pipeline

Each document goes through these stages in sequence via chained Celery tasks. After each stage, update `status` in MongoDB so the frontend polling endpoint reflects real progress.

```
upload (API) 
  → [status: pending]
  → extract_text.delay(document_id)
      → [status: extracting]
      → classify_document.delay(document_id)
          → [status: classifying]
          → run_compliance.delay(document_id)
              → [status: validating]
              → generate_summary.delay(document_id)
                  → [status: completed]
                  → notify_reviewers.delay(document_id)
```

If any task fails: set `status: failed`, log error, notify uploader.

---

## OCR & Extraction Service

```python
# ocr_service.py
def extract_text(file_path: str, file_type: str) -> str:
  local_path = file_path

    if file_type in ["png", "jpg", "jpeg"]:
        text = tesseract_extract(local_path)
        if len(text.strip()) < 50:
            text = textract_extract(local_path)

    elif file_type == "pdf":
        text = tika_extract(local_path)
        if len(text.strip()) < 100:
            text = textract_extract(local_path)

    elif file_type == "docx":
        text = docx_extract(local_path)

    cleanup_local(local_path)
    return text

def textract_extract(file_path: str) -> str:
    client = boto3.client("textract", region_name=settings.AWS_REGION)
  with open(file_path, "rb") as file_handle:
    file_bytes = file_handle.read()
    response = client.detect_document_text(
    Document={"Bytes": file_bytes}
    )
    lines = [b["Text"] for b in response["Blocks"] if b["BlockType"] == "LINE"]
    return "\n".join(lines)
```

---

## Document Classification Service

```python
# classifier_service.py
RULES = {
    "Medical Record":       ["patient", "diagnosis", "treatment", "physician", "icd", "prescription"],
    "Consent Form":         ["consent", "i authorize", "patient authorization", "signature required"],
    "Legal Contract":       ["whereas", "indemnify", "governing law", "breach", "termination clause"],
    "Privacy Policy":       ["personal data", "data subject", "right to erasure", "data controller"],
    "Invoice":              ["invoice number", "amount due", "bill to", "payment terms"],
    "Audit Report":         ["audit findings", "auditor", "material weakness", "scope of audit"],
    "Employment Agreement": ["employee", "employer", "non-compete", "salary", "at-will"],
    "Insurance Policy":     ["policyholder", "premium", "deductible", "insurer", "claim"],
    "Procurement Document": ["purchase order", "vendor", "rfp", "bid", "supplier"],
}

def classify(extracted_text: str) -> dict:
    text_lower = extracted_text.lower()
    scores = {}
    for doc_type, keywords in RULES.items():
        matches = sum(1 for kw in keywords if kw in text_lower)
        scores[doc_type] = matches / len(keywords)

    best_type = max(scores, key=scores.get)
    confidence = scores[best_type]

    if confidence < 0.75:
        # Fall back to Bedrock
        return bedrock_service.classify_document_with_ai(extracted_text)

    return {"document_type": best_type, "confidence": round(confidence, 2), "reasoning": "Rule-based match"}
```

---

## Compliance Engine

### Rule JSON Format
```json
{
  "id": "HIPAA-001",
  "category": "Data Privacy",
  "description": "Patient SSN must not appear in plain text",
  "severity": "critical",
  "detection_type": "pattern",
  "pattern": "\\b\\d{3}-\\d{2}-\\d{4}\\b",
  "generic_fix": "Redact or encrypt all SSN values before storing."
}
```

Detection types:
- `pattern` — regex match (violation if pattern FOUND)
- `keyword_required` — violation if listed keywords are ABSENT
- `keyword_forbidden` — violation if listed keywords are PRESENT
- `nlp_entity` — spaCy NER entity type detection

### Violation Output
```json
{
  "rule_id": "HIPAA-001",
  "category": "Data Privacy",
  "severity": "critical",
  "description": "Patient SSN in plain text",
  "matched_text": "123-45-6789",
  "offset_start": 420,
  "offset_end": 431,
  "generic_fix": "Redact or encrypt all SSN values.",
  "ai_fix_suggestion": "Replace '123-45-6789' with '[REDACTED-SSN]' and store using AES-256 encryption."
}
```

### Risk Score
```python
WEIGHTS = {"critical": 40, "warning": 20, "info": 5}

def calculate_risk_score(violations: list) -> int:
    return min(sum(WEIGHTS.get(v["severity"], 0) for v in violations), 100)
```

---

## Built-in Compliance Checklists

Build all as JSON files in `backend/app/checklists/`. Each has 10–12 rules.

### hipaa.json rules
- SSN in plain text (pattern)
- DOB exposed (pattern)
- Patient consent signature required (keyword_required: ["patient signature", "consent", "authorized by"])
- PHI encryption clause (keyword_required: ["encryption", "encrypted", "aes"])
- Minimum necessary standard (keyword_required: ["minimum necessary"])
- Data sharing authorization (keyword_required: ["authorized to share", "data sharing agreement"])
- Breach notification clause (keyword_required: ["breach notification", "notify within"])
- Business associate agreement (keyword_required: ["business associate", "baa"])
- Access control policy (keyword_required: ["access control", "role-based access"])
- Audit controls (keyword_required: ["audit log", "audit trail"])
- Transmission security (keyword_required: ["transmission security", "tls", "ssl", "encrypted transmission"])
- De-identification (keyword_required: ["de-identified", "de-identification"])

### gdpr.json rules
- Lawful basis stated (keyword_required: ["lawful basis", "legal basis"])
- Data subject rights (keyword_required: ["right to access", "data subject rights"])
- Right to erasure (keyword_required: ["right to erasure", "right to be forgotten"])
- Retention period (keyword_required: ["retention period", "data retention"])
- DPO contact (keyword_required: ["data protection officer", "dpo"])
- Cross-border transfers (keyword_required: ["standard contractual clauses", "adequacy decision"])
- Consent withdrawal (keyword_required: ["withdraw consent", "opt out"])
- Cookie policy (keyword_required: ["cookie policy", "cookies"])
- 72-hour breach notification (keyword_required: ["72 hours", "supervisory authority"])
- Privacy by design (keyword_required: ["privacy by design", "data protection by design"])
- Data minimization (keyword_required: ["data minimization", "minimum data"])
- Processor agreements (keyword_required: ["data processor", "processing agreement"])

### soc2.json rules
- Security policy (keyword_required)
- Change management (keyword_required)
- Incident response (keyword_required)
- Vendor management (keyword_required)
- Logical access controls (keyword_required)
- Availability commitments (keyword_required)
- Confidentiality agreements (keyword_required)
- Processing integrity (keyword_required)
- Monitoring and logging (keyword_required)
- Vulnerability management (keyword_required)

### pci_dss.json rules
- Full PAN in plain text (pattern: credit card number regex)
- CVV/CVC stored (keyword_forbidden: ["cvv", "cvc", "card verification"])
- Cardholder data protection (keyword_required)
- Encryption standard (keyword_required)
- Network segmentation (keyword_required)
- Access restriction (keyword_required)
- Security testing (keyword_required)
- Incident response (keyword_required)
- Firewall configuration (keyword_required)
- Anti-malware policy (keyword_required)

---

## Dashboard & UI Pages

### Dashboard (`/dashboard`)
- Stat cards: Total Documents | Pending Review | Critical Violations | Approved Today
- Documents table: name, type, checklist, risk badge, status badge, uploader, date, action buttons
- Filter bar: All / Pending / Approved / Rejected / High Risk
- Real-time status: `useDocumentStatus` hook polls `GET /api/documents/:id/status` every 5s for processing docs

### Upload (`/upload`)
- React Dropzone: PDF, DOCX, PNG, JPG, max 50MB, batch up to 10
- Checklist dropdown
- Per-file progress bars
- On complete: redirect to `/documents/:id`

### Document Review (`/documents/:id`)
- **Left panel**: PDF viewer with violation highlight overlays (character offsets → pdfjs text layer coordinates)
- **Right panel — 3 tabs**:
  - Overview: classification badge, confidence %, risk score meter, AI summary, key clauses, document purpose
  - Violations: grouped by severity (critical → warning → info). Each card: severity badge, rule ID, description, matched text snippet, generic fix, AI-specific fix
  - Actions: Approve button | Reject button + reason textarea | Comment input | Download Report (PDF/DOCX selector)
- Status banner: Processing… / Completed / Approved / Rejected

### Audit Logs (`/audit-logs`)
- Filterable table: timestamp, user, action, document, metadata
- Date range picker + user filter + action type filter
- Export CSV button

### Checklist Builder (`/checklists`)
- List of built-in + custom checklists with rule counts
- Form: name, category, severity, detection type, pattern/keywords, fix suggestion
- Save to MongoDB, activate per-upload

### Admin Users (`/admin/users`) — Admin only
- Table: name, email, role badge, status, last login
- Change role dropdown per user
- Deactivate/reactivate toggle

### Settings (`/settings`)
- Profile: name, email (read-only), role badge
- Change password form (current + new + confirm)
- Notification preferences

---

## Audit Report Generation

`POST /api/reports/generate/:id?format=pdf|docx`

**Report sections:**
1. Header — DocuGuard logo text, report ID, generated date/time
2. Document Information — original filename, type, classification, confidence, uploader, upload date
3. AI Summary — paragraph + key clauses list + document purpose
4. Compliance Framework — checklist name, version, total rules checked
5. Violations Summary — count by severity, risk score with ASCII progress bar
6. Detailed Violations Table — Rule ID | Category | Severity | Description | AI Fix Suggestion
7. Approval Status — status, approved/rejected by (name + email), date, reason
8. Auditor Signature Line — blank field for physical signing

**Delivery:**
- Save to local disk: `storage/reports/{document_id}/audit_report_{timestamp}.pdf`
- Store `audit_report_path` in MongoDB
- Return authenticated download URL

---

## Role-Based Access Control

| Role | Permissions |
|---|---|
| `admin` | Everything: manage users, delete documents, manage checklists, view all |
| `reviewer` | Upload, review, annotate, approve/reject, download reports |
| `auditor` | Read-only: view documents, violations, audit logs |

Default role on register: `reviewer`. Admin promotes users via `/admin/users`.

Backend enforcement:
```python
@router.patch("/{id}/approve")
async def approve(id: str, user=Depends(require_role("admin", "reviewer"))): ...

@router.delete("/{id}")
async def delete(id: str, user=Depends(require_role("admin"))): ...

@router.get("/audit-logs")
async def logs(user=Depends(require_role("admin", "auditor"))): ...
```

---

## Notifications

- Poll `GET /api/notifications` every 30s
- Bell icon in Navbar shows unread count badge
- Notify reviewers when a new document finishes processing
- Notify uploader when their document is approved or rejected
- `PATCH /api/notifications/:id/read` and `PATCH /api/notifications/read-all`

---

## API Endpoints

```
AUTH
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me

DOCUMENTS
POST   /api/documents/upload
GET    /api/documents
GET    /api/documents/:id
GET    /api/documents/:id/status
PATCH  /api/documents/:id/approve
PATCH  /api/documents/:id/reject
DELETE /api/documents/:id

COMPLIANCE
POST   /api/compliance/validate/:id
GET    /api/compliance/checklists
POST   /api/compliance/checklists
PUT    /api/compliance/checklists/:id
DELETE /api/compliance/checklists/:id

REPORTS
POST   /api/reports/generate/:id
GET    /api/reports/:id/download

USERS (Admin only)
GET    /api/users
PATCH  /api/users/:id/role
PATCH  /api/users/:id/deactivate

AUDIT LOGS
GET    /api/audit-logs
GET    /api/audit-logs/export

NOTIFICATIONS
GET    /api/notifications
PATCH  /api/notifications/:id/read
PATCH  /api/notifications/read-all
```

---

## Docker Compose

```yaml
version: '3.8'
services:
  api:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: ./backend/.env
    depends_on:
      - redis
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes:
      - ./backend:/app

  worker:
    build: ./backend
    command: celery -A app.tasks.celery_app worker --loglevel=info --concurrency=4
    env_file: ./backend/.env
    depends_on:
      - redis
    volumes:
      - ./backend:/app

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  frontend:
    build: ./frontend
    ports:
      - "5173:5173"
    env_file: ./frontend/.env
    volumes:
      - ./frontend:/app
      - /app/node_modules
    command: npm run dev -- --host
```

---

## Dockerfile (Backend)

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    default-jdk \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m spacy download en_core_web_sm

COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## Security Checklist

- Passwords hashed with bcrypt (cost factor 12) — never stored plain
- JWT access tokens short-lived (1hr), refresh tokens (7 days) with rotation
- Refresh token blacklist in Redis on logout (TTL matches token expiry)
- Access token in memory only (not localStorage), refresh token in httpOnly cookie
- File type validation using python-magic (magic bytes, not extension)
- Local storage stays outside the public web root — all access via authenticated download endpoints
- Rate limiting via slowapi — 10/min on upload, 30/min on validation
- CORS — whitelist only `ALLOWED_ORIGINS`
- `extracted_text` field encrypted with AES-256 Fernet before storing in MongoDB
- Security headers middleware — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- No raw string queries to MongoDB — Motor ORM throughout
- All secrets via `.env` — nothing hardcoded

---

## Build Order

Follow this sequence exactly:

1. Docker Compose + full project scaffold + Dockerfile
2. Custom JWT auth (register, login, refresh, logout, me) + bcrypt password hashing
3. Local storage service + document upload endpoint + MongoDB schemas
4. Celery + Redis task queue setup + task chaining architecture
5. OCR service (Tesseract → Textract fallback) + parser service
6. Document classification service (rule-based → Bedrock fallback)
7. Compliance JSON checklists (HIPAA, GDPR, SOC 2, PCI-DSS)
8. Compliance engine (pattern + keyword + NLP detection + risk scoring)
9. Bedrock service (summarization + AI fix suggestions)
10. React dashboard — Dashboard, Upload, Document Review pages
11. PDF viewer with violation annotation highlights
12. Audit report generation (PDF + DOCX)
13. RBAC middleware + Admin user panel
14. Notifications + audit trail
15. Security hardening — rate limiting, magic bytes, JWT blacklist, encryption, headers

---

## Key Constraints

- All Bedrock calls wrapped in try/except — fall back to `generic_fix` from rule JSON if Bedrock fails
- Local files always private — store outside the public web root and serve through authenticated endpoints
- Celery updates `status` field in MongoDB after every pipeline step
- Textract takes local file bytes directly — do not rely on cloud object storage
- Motor (async MongoDB) used throughout — not PyMongo directly
- spaCy model downloaded in Dockerfile at build time — not at runtime
- Tika requires Java in the Docker image — included in Dockerfile above
- Character offsets stored precisely in violations — used by frontend PDF viewer for highlight positioning
- Enable Bedrock model in AWS Console → Bedrock → Model Access before first run
- Redis also used as JWT blacklist store — same Redis instance, different key namespace (`blacklist:jti`)
- First registered user: manually set role to `admin` in MongoDB, or seed script on first run

---

*Project: DocuGuard | Version: 3.0.0 | Auth: Custom JWT + bcrypt | AI: AWS Bedrock Claude 3.5 Sonnet | No Firebase | No OpenAI*
