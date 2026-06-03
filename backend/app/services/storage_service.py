"""Local filesystem storage (NO S3).

All files live under ``LOCAL_STORAGE_DIR`` which sits outside any public web root. Files are
only ever served back to clients through authenticated download endpoints. Every relative path
is resolved and confirmed to stay inside the storage root to block path-traversal (``../``).
"""
from pathlib import Path

from app.config import settings

STORAGE_ROOT = Path(settings.LOCAL_STORAGE_DIR).resolve()


def _safe_path(relative_path: str) -> Path:
    """Resolve ``relative_path`` under STORAGE_ROOT, rejecting traversal outside the root."""
    candidate = (STORAGE_ROOT / relative_path).resolve()
    if candidate != STORAGE_ROOT and STORAGE_ROOT not in candidate.parents:
        raise ValueError("Resolved path escapes the storage root")
    return candidate


def save_file(file_bytes: bytes, relative_path: str) -> str:
    """Write ``file_bytes`` to ``relative_path`` under the storage root. Returns the relative path."""
    target = _safe_path(relative_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(file_bytes)
    return relative_path


def get_file_path(relative_path: str) -> Path:
    """Return the absolute Path for a stored file, raising FileNotFoundError if missing."""
    target = _safe_path(relative_path)
    if not target.is_file():
        raise FileNotFoundError(relative_path)
    return target


def read_file(relative_path: str) -> bytes:
    return get_file_path(relative_path).read_bytes()


def delete_file(relative_path: str) -> bool:
    target = _safe_path(relative_path)
    if target.is_file():
        target.unlink()
        return True
    return False
