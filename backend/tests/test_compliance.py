"""Offline (no-AWS) Phase 3 compliance-engine QA.

    docker compose exec -T worker python -m tests.test_compliance

Bedrock AI fix suggestions are NOT exercised here (they need AWS); they are attached by the
Celery task and degrade to a safe string without credentials. This validates the deterministic
engine: detection types, precise character offsets, and risk scoring.
"""
import sys
import traceback

results: list[tuple[str, bool, str]] = []


def check(name: str, cond: bool, detail: str = "") -> None:
    results.append((name, bool(cond), detail))
    print(f"[{'PASS' if cond else 'FAIL'}] {name}" + (f" — {detail}" if detail else ""))


def run() -> None:
    from app.services import checklist_service
    from app.services.compliance_engine import evaluate, calculate_risk_score, risk_level

    # All built-in checklists load
    for slug in ["hipaa", "gdpr", "soc2", "pci_dss", "internal_audit"]:
        cl = checklist_service.load_builtin(slug)
        check(f"checklist {slug} loads with rules", bool(cl) and len(cl["rules"]) > 0,
              f"{len(cl['rules']) if cl else 0} rules")

    hipaa = checklist_service.load_builtin("hipaa")
    text = "Patient John Doe SSN 123-45-6789 was seen on 01/02/1990 at the clinic."
    violations, score, level = evaluate(text, hipaa)

    ssn = next((v for v in violations if v["rule_id"] == "HIPAA-001"), None)
    check("HIPAA-001 SSN detected", ssn is not None and ssn["matched_text"] == "123-45-6789",
          ssn["matched_text"] if ssn else "none")
    check("HIPAA-001 severity critical", bool(ssn) and ssn["severity"] == "critical")
    check("character offsets are precise",
          bool(ssn) and text[ssn["offset_start"]:ssn["offset_end"]] == ssn["matched_text"])

    consent = next((v for v in violations if v["rule_id"] == "HIPAA-003"), None)
    check("keyword_required absence -> violation with null offset",
          consent is not None and consent["offset_start"] is None)

    check("dirty doc risk_level High", level == "High", f"score={score}, level={level}")

    # Risk math
    check("no violations -> 0 / Low", calculate_risk_score([]) == 0 and risk_level(0) == "Low")
    check("2 critical -> 80 / High",
          calculate_risk_score([{"severity": "critical"}, {"severity": "critical"}]) == 80
          and risk_level(80) == "High")
    check("risk score capped at 100",
          calculate_risk_score([{"severity": "critical"}] * 5) == 100)

    # PCI-DSS: PAN pattern + CVV forbidden
    pci = checklist_service.load_builtin("pci_dss")
    ptext = "Payment with card 4111 1111 1111 1111 and the cvv 123 was stored in the log."
    pviol, _pscore, _plevel = evaluate(ptext, pci)
    pan = next((v for v in pviol if v["rule_id"] == "PCI-001"), None)
    cvv = next((v for v in pviol if v["rule_id"] == "PCI-002"), None)
    check("PCI-001 PAN pattern detected", pan is not None, pan["matched_text"] if pan else "none")
    check("PCI-001 PAN offsets precise",
          bool(pan) and ptext[pan["offset_start"]:pan["offset_end"]] == pan["matched_text"])
    check("PCI-002 CVV forbidden keyword detected", cvv is not None)

    # Custom checklist evaluated the same way
    custom = {"rules": [{
        "id": "C-1", "category": "Custom", "description": "Forbidden term present",
        "severity": "warning", "detection_type": "keyword_forbidden",
        "keywords": ["secret-token"], "generic_fix": "Remove it.",
    }]}
    cviol, _s, _l = evaluate("this contains a SECRET-TOKEN value", custom)
    check("custom keyword_forbidden fires",
          len(cviol) == 1 and cviol[0]["matched_text"].lower() == "secret-token")


if __name__ == "__main__":
    try:
        run()
    except Exception:
        traceback.print_exc()
        results.append(("test harness crashed", False, ""))
    passed = sum(1 for _, ok, _ in results if ok)
    print(f"\n==== Phase 3 compliance QA: {passed}/{len(results)} passed ====")
    sys.exit(0 if passed == len(results) else 1)
