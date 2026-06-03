"""Host-side HTTP QA for Phase 3 — compliance checklists + end-to-end violation detection.

    python scripts/qa_phase3.py [--base http://localhost:8000/api]

Prereqs: stack up, worker restarted to load Phase 3 task code, and fixtures generated
(`docker compose exec -T worker python -m tests.test_offline`) so sample_phi.docx exists.
"""
import argparse
import http.cookiejar
import json
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHI_DOCX = ROOT / "backend" / "tests" / "fixtures" / "sample_phi.docx"
DOCX_CT = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

results: list[tuple[str, bool, str]] = []
jar = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def req(method, url, *, token=None, json_body=None, raw_body=None, content_type=None):
    headers, data = {}, None
    if json_body is not None:
        data = json.dumps(json_body).encode()
        headers["Content-Type"] = "application/json"
    elif raw_body is not None:
        data = raw_body
        if content_type:
            headers["Content-Type"] = content_type
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = opener.open(r, timeout=30)
        status, body = resp.status, resp.read()
    except urllib.error.HTTPError as e:
        status, body = e.code, e.read()
    try:
        parsed = json.loads(body) if body else {}
    except Exception:
        parsed = body.decode(errors="replace")
    return status, parsed


def multipart(field, filename, content, ctype, fields=None):
    b = "----dgP3"
    out = b""
    for k, v in (fields or {}).items():
        out += f"--{b}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{v}\r\n".encode()
    out += (f"--{b}\r\nContent-Disposition: form-data; name=\"{field}\"; filename=\"{filename}\"\r\n"
            f"Content-Type: {ctype}\r\n\r\n").encode() + content + b"\r\n"
    out += f"--{b}--\r\n".encode()
    return out, f"multipart/form-data; boundary={b}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000/api")
    args = ap.parse_args()
    B = args.base.rstrip("/")
    email = f"qa3{int(time.time())}@example.com"
    pw = "QaPassw0rd!"

    req("POST", f"{B}/auth/register", json_body={"email": email, "password": pw, "full_name": "QA3"})
    _, body = req("POST", f"{B}/auth/login", json_body={"email": email, "password": pw})
    token = body.get("access_token")
    check("login for QA3", bool(token))

    # ── Checklist API ────────────────────────────────────────────
    st, body = req("GET", f"{B}/compliance/checklists", token=token)
    slugs = {c["slug"] for c in body} if isinstance(body, list) else set()
    check("GET checklists lists 5 built-ins",
          st == 200 and {"hipaa", "gdpr", "soc2", "pci_dss", "internal_audit"} <= slugs, str(sorted(slugs)))

    st, body = req("GET", f"{B}/compliance/checklists/hipaa", token=token)
    check("GET hipaa has 12 rules", st == 200 and body.get("rule_count") == 12, str(body.get("rule_count")))

    custom_slug = f"custom_{int(time.time())}"
    custom = {"name": "Custom QA", "slug": custom_slug, "version": "1.0", "rules": [
        {"id": "C-1", "category": "Custom", "description": "Forbidden term",
         "severity": "critical", "detection_type": "keyword_forbidden",
         "keywords": ["topsecret"], "generic_fix": "Remove it."}]}
    st, _ = req("POST", f"{B}/compliance/checklists", token=token, json_body=custom)
    check("create custom checklist -> 201", st == 201, str(st))

    st, _ = req("POST", f"{B}/compliance/checklists", token=token, json_body=custom)
    check("duplicate slug -> 409", st == 409, str(st))

    st, _ = req("PUT", f"{B}/compliance/checklists/hipaa", token=token, json_body={"name": "x"})
    check("update built-in -> 403", st == 403, str(st))

    st, _ = req("DELETE", f"{B}/compliance/checklists/hipaa", token=token)
    check("delete built-in -> 403", st == 403, str(st))

    # Reviewer can create a custom checklist but NOT delete one (delete is admin-only per RBAC).
    st, _ = req("DELETE", f"{B}/compliance/checklists/{custom_slug}", token=token)
    check("delete custom as reviewer -> 403 (admin only)", st == 403, str(st))

    # ── End-to-end: upload PHI doc under HIPAA, expect SSN violation ──
    if not PHI_DOCX.exists():
        check("PHI fixture present", False, "run test_offline first")
    else:
        body_bytes, ctype = multipart("files", "sample_phi.docx", PHI_DOCX.read_bytes(), DOCX_CT,
                                      {"checklist_id": "hipaa"})
        st, body = req("POST", f"{B}/documents/upload", token=token, raw_body=body_bytes, content_type=ctype)
        doc_id = (body.get("document_ids") or [None])[0] if isinstance(body, dict) else None
        check("upload PHI doc -> 201", st == 201 and doc_id, str(st))

        final = None
        for _ in range(40):
            _, s = req("GET", f"{B}/documents/{doc_id}/status", token=token)
            final = s.get("status") if isinstance(s, dict) else None
            if final in ("completed", "failed"):
                break
            time.sleep(1.5)
        check("PHI pipeline reaches completed", final == "completed", f"status={final}")

        _, doc = req("GET", f"{B}/documents/{doc_id}", token=token)
        violations = doc.get("violations", []) if isinstance(doc, dict) else []
        ssn = next((v for v in violations if v.get("rule_id") == "HIPAA-001"), None)
        check("HIPAA-001 SSN violation present", ssn is not None and ssn.get("matched_text") == "123-45-6789",
              ssn.get("matched_text") if ssn else "none")
        check("violation has ai_fix_suggestion (Bedrock or fallback)",
              bool(ssn) and bool(ssn.get("ai_fix_suggestion")), ssn.get("ai_fix_suggestion") if ssn else "")
        check("document has risk_level + risk_score",
              doc.get("risk_level") in ("Low", "Medium", "High") and isinstance(doc.get("risk_score"), int),
              f"{doc.get('risk_level')} / {doc.get('risk_score')}")

        st, _ = req("POST", f"{B}/compliance/validate/{doc_id}", token=token, json_body={"checklist_id": "gdpr"})
        check("re-validate with checklist switch -> 202", st == 202, str(st))

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n==== Phase 3 HTTP QA: {passed}/{len(results)} passed ====")
    raise SystemExit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
