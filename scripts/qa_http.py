"""Host-side HTTP QA harness for DocuGuard Phase 1 (auth) + Phase 2 (upload pipeline).

Runs against the live API using only the Python standard library (no extra deps).

    python scripts/qa_http.py [--base http://localhost:8000/api]

Prerequisites:
  - The stack is up (`docker compose up --build`).
  - Offline fixtures generated first so a valid DOCX exists to upload:
        docker compose exec -T worker python -m tests.test_offline
    (creates backend/tests/fixtures/sample_contract.docx, visible on the host).
"""
import argparse
import base64
import http.cookiejar
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIXTURE_DOCX = ROOT / "backend" / "tests" / "fixtures" / "sample_contract.docx"

# 1x1 PNG (valid magic bytes) for the spoofed-extension test.
TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)
# DOS/PE header — detected as an executable, never an accepted type.
FAKE_EXE = b"MZ\x90\x00\x03\x00\x00\x00" + b"\x00" * 64

results: list[tuple[str, bool, str]] = []
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def check(name: str, cond: bool, detail: str = "") -> None:
    results.append((name, bool(cond), detail))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def request(method, url, *, token=None, json_body=None, raw_body=None,
            content_type=None, cookie=None, use_opener=True):
    """Return (status, headers, parsed_or_text). Uses the cookie jar unless cookie= is given."""
    headers = {}
    data = None
    if json_body is not None:
        data = json.dumps(json_body).encode()
        headers["Content-Type"] = "application/json"
    elif raw_body is not None:
        data = raw_body
        if content_type:
            headers["Content-Type"] = content_type
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if cookie:
        headers["Cookie"] = cookie

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    sender = (opener.open if (use_opener and not cookie) else urllib.request.urlopen)
    try:
        resp = sender(req, timeout=30)
        status, body, rheaders = resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        status, body, rheaders = e.code, e.read(), dict(e.headers)
    try:
        parsed = json.loads(body) if body else {}
    except Exception:
        parsed = body.decode(errors="replace")
    return status, rheaders, parsed


def multipart(files, fields=None):
    boundary = "----docuguardQA"
    out = b""
    for k, v in (fields or {}).items():
        out += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n").encode()
    for field, filename, content, ctype in files:
        out += (f"--{boundary}\r\nContent-Disposition: form-data; name=\"{field}\"; "
                f"filename=\"{filename}\"\r\nContent-Type: {ctype}\r\n\r\n").encode()
        out += content + b"\r\n"
    out += f"--{boundary}--\r\n".encode()
    return out, f"multipart/form-data; boundary={boundary}"


def cookie_value(name):
    for c in jar:
        if c.name == name:
            return f"{c.name}={c.value}"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000/api")
    args = ap.parse_args()
    B = args.base.rstrip("/")
    email = f"qa{int(time.time())}@example.com"
    pw = "QaPassw0rd!"

    # ── Phase 1: auth ────────────────────────────────────────────
    st, _, body = request("GET", f"{B}/health")
    svc = body.get("services", {}) if isinstance(body, dict) else {}
    check("GET /health mongo+redis connected", st == 200 and svc.get("mongodb") and svc.get("redis"), str(body))

    st, _, body = request("POST", f"{B}/auth/register",
                          json_body={"email": email, "password": pw, "full_name": "QA Bot"})
    check("register valid -> 201, no hash, role reviewer",
          st == 201 and "hashed_password" not in body and body.get("role") == "reviewer", f"{st}")

    st, _, _ = request("POST", f"{B}/auth/register",
                       json_body={"email": email, "password": pw, "full_name": "QA Bot"})
    check("duplicate register -> 409", st == 409, f"{st}")

    st, _, _ = request("POST", f"{B}/auth/login", json_body={"email": email, "password": "wrong"})
    check("login wrong password -> 401", st == 401, f"{st}")

    st, _, body = request("POST", f"{B}/auth/login", json_body={"email": email, "password": pw})
    token = body.get("access_token") if isinstance(body, dict) else None
    check("login correct -> 200 + access_token + refresh cookie",
          st == 200 and token and cookie_value("refresh_token") is not None, f"{st}")

    st, _, body = request("GET", f"{B}/auth/me", token=token)
    check("GET /me with token -> 200, no hash",
          st == 200 and body.get("email") == email and "hashed_password" not in body, f"{st}")

    st, _, _ = request("GET", f"{B}/auth/me")
    check("GET /me without token -> 401", st == 401, f"{st}")

    saved_cookie = cookie_value("refresh_token")
    st, _, body = request("POST", f"{B}/auth/refresh")
    new_token = body.get("access_token") if isinstance(body, dict) else None
    check("refresh with cookie -> 200 new token", st == 200 and new_token and new_token != token, f"{st}")

    st, _, _ = request("POST", f"{B}/auth/logout")
    check("logout -> 200", st == 200, f"{st}")

    # Re-send the *pre-logout* refresh cookie manually to prove Redis blacklisting.
    st, _, _ = request("POST", f"{B}/auth/refresh", cookie=saved_cookie)
    check("blacklisted refresh token -> 401", st == 401, f"{st}")

    # ── Phase 2: upload pipeline ─────────────────────────────────
    body_bytes, ctype = multipart([("files", "x.exe", FAKE_EXE, "application/octet-stream")],
                                  {"checklist_id": "hipaa"})
    st, _, _ = request("POST", f"{B}/documents/upload", token=token, raw_body=body_bytes, content_type=ctype)
    check("upload forbidden .exe -> 415", st == 415, f"{st}")

    body_bytes, ctype = multipart([("files", "report.pdf", TINY_PNG, "application/pdf")],
                                  {"checklist_id": "hipaa"})
    st, _, _ = request("POST", f"{B}/documents/upload", token=token, raw_body=body_bytes, content_type=ctype)
    check("upload PNG-spoofed-as-.pdf -> 415", st == 415, f"{st}")

    body_bytes, ctype = multipart([("files", "x.exe", FAKE_EXE, "application/octet-stream")])
    st, _, _ = request("POST", f"{B}/documents/upload", raw_body=body_bytes, content_type=ctype)
    check("upload without auth -> 401", st == 401, f"{st}")

    if not FIXTURE_DOCX.exists():
        check("valid DOCX upload (fixture present)", False,
              "fixture missing — run: docker compose exec -T worker python -m tests.test_offline")
    else:
        docx_bytes = FIXTURE_DOCX.read_bytes()
        body_bytes, ctype = multipart(
            [("files", "sample_contract.docx", docx_bytes,
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document")],
            {"checklist_id": "hipaa"})
        st, _, body = request("POST", f"{B}/documents/upload", token=token, raw_body=body_bytes, content_type=ctype)
        doc_id = (body.get("document_ids") or [None])[0] if isinstance(body, dict) else None
        check("valid DOCX upload -> 201 + document id", st == 201 and doc_id, f"{st}")

        final = None
        if doc_id:
            for _ in range(40):  # up to ~60s
                s2, _, sbody = request("GET", f"{B}/documents/{doc_id}/status", token=token)
                final = sbody.get("status") if isinstance(sbody, dict) else None
                if final in ("completed", "failed"):
                    break
                time.sleep(1.5)
            check("DOCX pipeline reaches completed", final == "completed", f"status={final}")

            s3, _, dbody = request("GET", f"{B}/documents/{doc_id}", token=token)
            cls = dbody.get("classification") if isinstance(dbody, dict) else None
            check("DOCX classified as Legal Contract (offline rule-based)",
                  cls == "Legal Contract", f"classification={cls}")

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n==== HTTP QA: {passed}/{len(results)} passed ====")
    raise SystemExit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
