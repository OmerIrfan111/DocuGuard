"""AES-256 field encryption (Fernet) for sensitive MongoDB fields (e.g. extracted_text)."""
from functools import lru_cache

from cryptography.fernet import Fernet

from app.config import settings


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    if not settings.FIELD_ENCRYPTION_KEY:
        raise RuntimeError(
            "FIELD_ENCRYPTION_KEY is not set. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(settings.FIELD_ENCRYPTION_KEY.encode())


def encrypt_text(plaintext: str) -> str:
    """Returns Fernet ciphertext (starts with 'gAAA')."""
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_text(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
