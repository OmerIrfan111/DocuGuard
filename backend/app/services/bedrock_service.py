"""AWS Bedrock (Claude 3.5 Sonnet) — summaries, fix suggestions, classification fallback.

Every call is wrapped in try/except; on any failure the caller receives a safe default so
the document pipeline never crashes when Bedrock is unavailable (per project constraints).
"""
import json

import boto3

from app.config import settings

_client = None


def _bedrock():
    global _client
    if _client is None:
        _client = boto3.client(
            service_name="bedrock-runtime",
            region_name=settings.BEDROCK_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        )
    return _client


def call_bedrock(prompt: str, max_tokens: int = 1500) -> str:
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": prompt}],
    })
    response = _bedrock().invoke_model(
        modelId=settings.BEDROCK_MODEL_ID,
        body=body,
        contentType="application/json",
        accept="application/json",
    )
    result = json.loads(response["body"].read())
    return result["content"][0]["text"]


def _extract_json(text: str) -> dict:
    """Bedrock sometimes wraps JSON in prose/fences; pull out the first JSON object."""
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text[text.find("{"):]
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end != -1:
        return json.loads(text[start:end + 1])
    return json.loads(text)


def summarize_document(extracted_text: str) -> dict:
    prompt = (
        "You are a compliance document expert. Analyze the following document and respond "
        "ONLY with a valid JSON object, no markdown, no explanation:\n"
        '{\n  "summary": "3-sentence plain-language summary",\n'
        '  "key_clauses": ["clause 1", "clause 2", "clause 3"],\n'
        '  "risk_level": "Low | Medium | High",\n'
        '  "document_purpose": "one sentence describing what this document is for"\n}\n\n'
        f"Document:\n{extracted_text[:6000]}"
    )
    try:
        return _extract_json(call_bedrock(prompt))
    except Exception:
        return {"summary": "Unavailable", "key_clauses": [], "risk_level": "Unknown", "document_purpose": "Unknown"}


def get_ai_fix_suggestion(rule_description: str, matched_text: str, context: str) -> str:
    prompt = (
        "You are a compliance expert. A document has violated a compliance rule.\n\n"
        f"Rule: {rule_description}\n"
        f'Problematic text: "{matched_text}"\n'
        f'Context: "{context}"\n\n'
        "Give a specific, actionable fix in 2-3 sentences. Be concrete. Plain text only, no markdown."
    )
    try:
        return call_bedrock(prompt, max_tokens=300).strip()
    except Exception:
        return "Manual review required."


def classify_document_with_ai(extracted_text: str) -> dict:
    prompt = (
        "Classify this document. Respond ONLY with valid JSON, no markdown:\n"
        '{\n  "document_type": "one of: Medical Record, Consent Form, Legal Contract, Invoice, '
        'Privacy Policy, Audit Report, Employment Agreement, Insurance Policy, Procurement Document, Unknown",\n'
        '  "confidence": 0.0,\n  "reasoning": "one sentence"\n}\n\n'
        f"Document (first 3000 chars):\n{extracted_text[:3000]}"
    )
    try:
        return _extract_json(call_bedrock(prompt, max_tokens=200))
    except Exception:
        return {"document_type": "Unknown", "confidence": 0.0, "reasoning": "Failed"}
