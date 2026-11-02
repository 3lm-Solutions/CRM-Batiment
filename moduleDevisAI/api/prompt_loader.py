from __future__ import annotations

from pathlib import Path


PROMPTS_DIRECTORY = Path(__file__).resolve().parents[1] / "prompts"


def load_system_prompt(name: str) -> str:
    path = PROMPTS_DIRECTORY / name
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError as error:
        raise RuntimeError(f"System prompt missing: {path}") from error
