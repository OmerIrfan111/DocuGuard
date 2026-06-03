"""Document classification: rule-based keyword scoring → AWS Bedrock fallback."""
from app.services import bedrock_service

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

CONFIDENCE_THRESHOLD = 0.75


def classify(extracted_text: str) -> dict:
    """Return {document_type, confidence, reasoning}.

    Falls back to Bedrock AI classification when the best rule-based score is below the
    confidence threshold (or when there is no usable text).
    """
    text_lower = (extracted_text or "").lower()

    if not text_lower.strip():
        return bedrock_service.classify_document_with_ai(extracted_text or "")

    scores = {
        doc_type: sum(1 for kw in keywords if kw in text_lower) / len(keywords)
        for doc_type, keywords in RULES.items()
    }
    best_type = max(scores, key=scores.get)
    confidence = scores[best_type]

    if confidence < CONFIDENCE_THRESHOLD:
        return bedrock_service.classify_document_with_ai(extracted_text)

    return {"document_type": best_type, "confidence": round(confidence, 2), "reasoning": "Rule-based match"}
