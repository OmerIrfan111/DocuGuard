"""Host-side HTTP QA for Phase 5 — security hardening (headers, CORS, rate limiting).

    python scripts/qa_phase5.py [--base http://localhost:8000/api]
"""
import argparse
import json
import time
import urllib.error
import urllib.request

MIN_PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def req(method, url, *, token=None, json_body=None, raw_body=None, content_type=None, origin=None):
    headers = {}
    data = None
    if json_body is not None:
        data = json.dumps(json_body).encode(); headers["Content-Type"] = "application/json"
    elif raw_body is not None:
        data = raw_body
        if content_type:
            headers["Content-Type"] = content_type
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if origin:
        headers["Origin"] = origin
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=30)
        return resp.status, dict(resp.headers), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def upload_body():
    b = "----p5"
    out = (f"--{b}\r\nContent-Disposition: form-data; name=\"checklist_id\"\r\n\r\nhipaa\r\n").encode()
    out += (f"--{b}\r\nContent-Disposition: form-data; name=\"files\"; filename=\"t.pdf\"\r\n"
            f"Content-Type: application/pdf\r\n\r\n").encode() + MIN_PDF + b"\r\n"
    out += f"--{b}--\r\n".encode()
    return out, f"multipart/form-data; boundary={b}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000/api")
    args = ap.parse_args()
    B = args.base.rstrip("/")
    email = f"qa5{int(time.time())}@example.com"

    req("POST", f"{B}/auth/register", json_body={"email": email, "password": "QaPass123!", "full_name": "QA5"})
    _, _, body = req("POST", f"{B}/auth/login", json_body={"email": email, "password": "QaPass123!"})
    token = json.loads(body).get("access_token")
    check("login", bool(token))

    # Security headers
    _, h, _ = req("GET", f"{B}/health")
    hl = {k.lower(): v for k, v in h.items()}
    for hdr in ["x-content-type-options", "x-frame-options", "referrer-policy", "permissions-policy"]:
        check(f"header {hdr} present", hdr in hl, hl.get(hdr, ''))

    # CORS: a non-whitelisted origin must NOT be echoed back
    _, h2, _ = req("GET", f"{B}/health", origin="http://evil.example.com")
    acao = {k.lower(): v for k, v in h2.items()}.get("access-control-allow-origin")
    check("CORS blocks non-whitelisted origin", acao != "http://evil.example.com", f"ACAO={acao}")

    # Upload rate limit: limit is 10/minute -> the 11th within a minute must be 429
    body, ctype = upload_body()
    codes = []
    for _ in range(12):
        st, _, _ = req("POST", f"{B}/documents/upload", token=token, raw_body=body, content_type=ctype)
        codes.append(st)
    first_429 = next((i + 1 for i, c in enumerate(codes) if c == 429), None)
    check("upload rate limit returns 429", 429 in codes, f"codes={codes}")
    check("429 triggers after ~10 allowed", first_429 is not None and first_429 >= 10, f"first 429 at request #{first_429}")

    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n==== Phase 5 HTTP QA: {passed}/{len(results)} passed ====")
    raise SystemExit(0 if passed == len(results) else 1)


if __name__ == "__main__":
    main()
