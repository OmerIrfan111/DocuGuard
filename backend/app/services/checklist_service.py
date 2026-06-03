"""Loading built-in (JSON file) checklists. Custom checklists live in MongoDB and are
loaded by the caller (async via Motor in the API, sync via PyMongo in the Celery worker)."""
import json
from functools import lru_cache
from pathlib import Path

CHECKLIST_DIR = Path(__file__).resolve().parent.parent / "checklists"


def builtin_slugs() -> list[str]:
    return sorted(p.stem for p in CHECKLIST_DIR.glob("*.json"))


@lru_cache(maxsize=32)
def load_builtin(slug: str) -> dict | None:
    path = CHECKLIST_DIR / f"{slug}.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def load_all_builtin() -> list[dict]:
    return [load_builtin(s) for s in builtin_slugs()]
