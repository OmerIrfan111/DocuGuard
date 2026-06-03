"""spaCy NLP entity extraction (used by the compliance engine's nlp_entity rules in Phase 3)."""
_nlp = None


def _model():
    global _nlp
    if _nlp is None:
        import spacy
        _nlp = spacy.load("en_core_web_sm")
    return _nlp


def extract_entities(text: str, entity_type: str | None = None) -> list[dict]:
    """Return entities as [{text, label, start, end}], optionally filtered by label.

    Returns [] if the model or text is unavailable so callers degrade gracefully.
    """
    try:
        doc = _model()(text or "")
    except Exception:
        return []
    out = []
    for ent in doc.ents:
        if entity_type and ent.label_ != entity_type:
            continue
        out.append({
            "text": ent.text,
            "label": ent.label_,
            "start": ent.start_char,
            "end": ent.end_char,
        })
    return out
