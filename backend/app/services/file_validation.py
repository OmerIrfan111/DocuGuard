"""Magic-byte file-type validation (not extension-based).

Uses python-magic (libmagic) when available. DOCX is an OOXML zip container, so a zip
signature combined with a .docx extension is accepted; everything else must match by content.
"""
from pathlib import Path

try:
    import magic  # python-magic
    _HAVE_MAGIC = True
except Exception:  # libmagic not present (e.g. bare Windows host)
    _HAVE_MAGIC = False

# Canonical type per accepted MIME type
_MIME_TO_TYPE = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}
# Canonical type per accepted file extension (for anti-spoof agreement checks)
_EXT_TO_TYPE = {"pdf": "pdf", "png": "png", "jpg": "jpg", "jpeg": "jpg", "docx": "docx"}
ACCEPTED_TYPES = {"pdf", "png", "jpg", "docx"}


def _sniff_mime(data: bytes) -> str:
    if _HAVE_MAGIC:
        return magic.from_buffer(data, mime=True)
    # Minimal fallback signature sniffing.
    if data[:4] == b"%PDF":
        return "application/pdf"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:2] == b"PK":
        return "application/zip"
    return "application/octet-stream"


def detect_file_type(data: bytes, original_name: str) -> str | None:
    """Return canonical file type ('pdf'|'png'|'jpg'|'docx') or None if rejected.

    Validation is content-first (magic bytes). When the filename carries an extension that
    maps to a *different* accepted type than the content, the upload is rejected as a spoof
    (e.g. a PNG renamed ``.pdf``). DOCX is an OOXML zip, so it is only accepted when the
    ``.docx`` extension agrees with the zip content.
    """
    mime = _sniff_mime(data)
    ext = Path(original_name).suffix.lower().lstrip(".")

    if mime in _MIME_TO_TYPE:
        content_type = _MIME_TO_TYPE[mime]
    elif mime in ("application/zip", "application/x-zip-compressed") and ext == "docx":
        content_type = "docx"
    else:
        return None  # content is not an accepted type (e.g. .exe, arbitrary bytes)

    # Anti-spoof: a known extension must agree with the detected content type.
    if ext in _EXT_TO_TYPE and _EXT_TO_TYPE[ext] != content_type:
        return None
    return content_type
