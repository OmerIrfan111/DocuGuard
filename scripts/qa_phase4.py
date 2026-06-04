"""Host-side HTTP QA for Phase 4 — review workflow, reports, users, audit logs, notifications.

    python scripts/qa_phase4.py [--base http://localhost:8000/api]

Prereqs: stack up; an admin seeded as admin@example.com / AdminPass123!
(`docker compose exec -T api python -m app.scripts.seed_admin --email admin@example.com --password AdminPass123! --name Admin`);
fixtures present (`docker compose exec -T worker python -m tests.test_offline`).
"""
import argparse
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / "backend" / "tests" / "fixtures" / "sample_contract.docx"
DOCX_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

results: list[tuple[str, bool, str]] = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def req(method, url, *, token=None, json_body=None, raw_body=None, content_type=None, want_bytes=False):
    headers, data = {}, None
    if json_body is not None:
        data = json.dumps(json_body).encode(); headers["Content-Type"] = "application/json"
    elif raw_body is not None:
        data = raw_body
        if content_type:
            headers["Content-Type"] = content_type
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=30)
        status, body, ctype = resp.status, resp.read(), resp.headers.get("Content-Type", "")
    except urllib.error.HTTPError as e:
        status, body, ctype = e.code, e.read(), ""
    if want_bytes:
        return status, body, ctype
    try:
        return status, (json.loads(body) if body else {}), ctype
    except Exception:
        return status, body.decode(errors="replace"), ctype


def login(B, email, pw):
    _, body, _ = req("POST", f"{B}/auth/login", json_body={"email": email, "password": pw})
    return body.get("access_token") if isinstance(body, dict) else None


def upload_docx(B, token):
    b = "----p4"
    body = (f"--{b}\r\nContent-Disposition: form-data; name=\"checklist_id\"\r\n\r\nhipaa\r\n").encode()
    body += (f"--{b}\r\nContent-Disposition: form-data; name=\"files\"; filename=\"sample_contract.docx\"\r\n"
             f"Content-Type: {DOCX_CT}\r\n\r\n").encode() + DOCX.read_bytes() + b"\r\n"
    body += f"--{b}--\r\n".encode()
    st, resp, _ = req("POST", f"{B}/documents/upload", token=token, raw_body=body,
                      content_type=f"multipart/form-data; boundary={b}")
    return (resp.get("document_ids") or [None])[0] if isinstance(resp, dict) else None


def wait_completed(B, token, doc_id):
    for _ in range(40):
        _, s, _ = req("GET", f"{B}/documents/{doc_id}/status", token=token)
        if isinstance(s, dict) and s.get("status") in ("completed", "failed"):
            return s.get("status")
        time.sleep(1.5)
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000/api")
    args = ap.parse_args()
    B = args.base.rstrip("/")

    admin = login(B, "admin@example.com", "AdminPass123!")
    check("admin login", bool(admin), "seed admin@example.com first" if not admin else "")
    if not admin:
        return _finish()

    rev_email = f"rev{int(time.time())}@example.com"
    req("POST", f"{B}/auth/register", json_body={"email": rev_email, "password": "RevPass123!", "full_name": "Rev"})
    reviewer = login(B, rev_email, "RevPass123!")
    check("reviewer login", bool(reviewer))

    # Dashboard stats
    st, stats, _ = req("GET", f"{B}/documents/stats", token=admin)
    check("GET /documents/stats has all cards",
          st == 200 and all(k in stats for k in
          ["total_documents", "pending_review", "critical_violations", "high_risk", "approved_today"]), str(stats))

    # Upload + pipeline
    doc_id = upload_docx(B, admin)
    check("upload doc", bool(doc_id))
    final = wait_completed(B, admin, doc_id)
    check("pipeline completed", final == "completed", f"status={final}")

    # Filtered list
    st, page, _ = req("GET", f"{B}/documents?approval=pending&limit=50", token=admin)
    ids = [d["id"] for d in page.get("items", [])] if isinstance(page, dict) else []
    check("list ?approval=pending returns envelope", st == 200 and "total" in page and doc_id in ids,
          f"total={page.get('total')}")

    # Reject requires reason; then approve
    st, _, _ = req("PATCH", f"{B}/documents/{doc_id}/reject", token=admin, json_body={})
    check("reject without reason -> 422", st == 422, str(st))
    st, body, _ = req("PATCH", f"{B}/documents/{doc_id}/reject", token=admin, json_body={"reason": "Missing consent"})
    check("reject with reason -> rejected", st == 200 and body.get("approval_status") == "rejected", str(st))
    st, body, _ = req("PATCH", f"{B}/documents/{doc_id}/approve", token=admin)
    check("approve -> approved", st == 200 and body.get("approval_status") == "approved", str(st))

    # Reports: PDF + DOCX generate + authenticated download
    st, gen, _ = req("POST", f"{B}/reports/generate/{doc_id}?format=pdf", token=admin)
    check("generate PDF report -> 201", st == 201 and gen.get("download_url"), str(st))
    st, body, ctype = req("GET", f"{B}/reports/{doc_id}/download", token=admin, want_bytes=True)
    check("download PDF -> %PDF bytes", st == 200 and body[:4] == b"%PDF", f"{st} {ctype}")
    st, gen2, _ = req("POST", f"{B}/reports/generate/{doc_id}?format=docx", token=admin)
    check("generate DOCX report -> 201", st == 201, str(st))
    st, body, _ = req("GET", f"{B}/reports/{doc_id}/download", token=admin, want_bytes=True)
    check("download DOCX -> PK zip bytes", st == 200 and body[:2] == b"PK", str(st))
    st, _, _ = req("GET", f"{B}/reports/{doc_id}/download", want_bytes=True)
    check("report download without auth -> 401", st == 401, str(st))

    # Original file stream (for PDF viewer)
    st, body, _ = req("GET", f"{B}/documents/{doc_id}/file", token=admin, want_bytes=True)
    check("GET /documents/:id/file streams original", st == 200 and body[:2] == b"PK", str(st))

    # Notifications (admin is the uploader -> approval/rejection notifications)
    st, notifs, _ = req("GET", f"{B}/notifications", token=admin)
    check("notifications present for uploader", st == 200 and notifs.get("unread_count", 0) >= 1,
          f"unread={notifs.get('unread_count')}")
    req("PATCH", f"{B}/notifications/read-all", token=admin)
    _, notifs2, _ = req("GET", f"{B}/notifications", token=admin)
    check("read-all clears unread", notifs2.get("unread_count") == 0, str(notifs2.get("unread_count")))

    # Users admin
    st, users, _ = req("GET", f"{B}/users", token=admin)
    rev = next((u for u in users if u.get("email") == rev_email), None) if isinstance(users, list) else None
    check("GET /users (admin) lists users", st == 200 and rev is not None)
    if rev:
        st, body, _ = req("PATCH", f"{B}/users/{rev['id']}/role", token=admin, json_body={"role": "auditor"})
        check("update role -> auditor", st == 200 and body.get("role") == "auditor", str(st))
        st, body, _ = req("PATCH", f"{B}/users/{rev['id']}/deactivate", token=admin, json_body={"is_active": False})
        check("deactivate user", st == 200 and body.get("is_active") is False, str(st))

    # Audit logs
    st, logs, _ = req("GET", f"{B}/audit-logs?limit=10", token=admin)
    check("GET /audit-logs (admin) returns items", st == 200 and logs.get("total", 0) > 0,
          f"total={logs.get('total')}")
    st, csv_body, ctype = req("GET", f"{B}/audit-logs/export", token=admin, want_bytes=True)
    check("audit-logs CSV export", st == 200 and b"timestamp,user_email,action" in csv_body, ctype)

    # RBAC: reviewer is forbidden from admin/auditor-only endpoints
    st, _, _ = req("GET", f"{B}/users", token=reviewer)
    check("reviewer GET /users -> 403", st == 403, str(st))
    st, _, _ = req("GET", f"{B}/audit-logs", token=reviewer)
    check("reviewer GET /audit-logs -> 403", st == 403, str(st))
    st, _, _ = req("DELETE", f"{B}/documents/{doc_id}", token=reviewer)
    check("reviewer DELETE document -> 403", st == 403, str(st))

    # Admin delete (cleanup)
    st, _, _ = req("DELETE", f"{B}/documents/{doc_id}", token=admin)
    check("admin DELETE document -> 200", st == 200, str(st))

    _finish()


def _finish():
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n==== Phase 4 HTTP QA: {passed}/{len(results)} passed ====")
    raise SystemExit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
