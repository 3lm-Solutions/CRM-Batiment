from __future__ import annotations


def display_text(value: object) -> str:
    """Repair legacy UTF-8 text that was decoded as a Latin-1 code page."""
    text = str(value)
    if not any(marker in text for marker in ("Ã", "Â", "â€")):
        return text
    for legacy_encoding in ("latin-1", "cp1252"):
        try:
            repaired = text.encode(legacy_encoding).decode("utf-8")
        except UnicodeError:
            continue
        if repaired:
            return repaired
    return text
