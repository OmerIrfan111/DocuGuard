"""OCR + text extraction orchestration.

Strategy (per spec):
  - images (png/jpg/jpeg): Tesseract → if < 50 chars, AWS Textract fallback
  - pdf:                    Apache Tika → if < 100 chars, AWS Textract fallback
  - docx:                   python-docx

Textract takes the local file *bytes* directly (no cloud object storage).
"""
from app.services.parser_service import tika_extract, docx_extract


def tesseract_extract(file_path: str) -> str:
    try:
        import pytesseract
        from PIL import Image
        return pytesseract.image_to_string(Image.open(file_path)).strip()
    except Exception:
        return ""


def textract_extract(file_path: str) -> str:
    """AWS Textract OCR using local file bytes. Returns '' on failure."""
    try:
        import boto3
        from app.config import settings
        client = boto3.client(
            "textract",
            region_name=settings.AWS_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or None,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or None,
        )
        with open(file_path, "rb") as fh:
            file_bytes = fh.read()
        response = client.detect_document_text(Document={"Bytes": file_bytes})
        lines = [b["Text"] for b in response.get("Blocks", []) if b.get("BlockType") == "LINE"]
        return "\n".join(lines).strip()
    except Exception:
        return ""


def extract_text(file_path: str, file_type: str) -> str:
    file_type = file_type.lower()

    if file_type in ("png", "jpg", "jpeg"):
        text = tesseract_extract(file_path)
        if len(text.strip()) < 50:
            text = textract_extract(file_path) or text

    elif file_type == "pdf":
        text = tika_extract(file_path)
        if len(text.strip()) < 100:
            text = textract_extract(file_path) or text

    elif file_type == "docx":
        text = docx_extract(file_path)

    else:
        text = ""

    return text
