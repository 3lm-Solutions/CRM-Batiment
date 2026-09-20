from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Literal, Mapping

from .errors import InvalidProviderError

ProviderName = Literal["openai", "anthropic", "google", "groq"]


@dataclass(frozen=True, slots=True)
class ToolRegistryConfig:

    provider: ProviderName = "openai"
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    google_api_key: str | None = None
    groq_api_key: str | None = None
    openai_text_model: str = "gpt-4o"
    openai_vision_model: str = "gpt-4o"
    openai_transcription_model: str = "whisper-1"
    anthropic_text_model: str = "claude-sonnet-5"
    anthropic_vision_model: str = "claude-sonnet-5"
    google_text_model: str = "gemini-3.7-flash"
    google_vision_model: str = "gemini-3.7-flash"
    groq_transcription_model: str = "whisper-large-v3-turbo"
    timeout_seconds: float = 120.0
    max_retries: int = 1
    max_output_tokens: int = 1024

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "ToolRegistryConfig":
        values = os.environ if env is None else env
        provider = values.get("TOOLREGISTRY_PROVIDER", "openai").strip().lower()
        if provider not in ("openai", "anthropic", "google", "groq"):
            raise InvalidProviderError(
                "TOOLREGISTRY_PROVIDER must be 'openai', 'anthropic', 'google', or 'groq'.",
                provider=provider or None,
            )

        return cls(
            provider=provider,
            openai_api_key=_optional(values.get("OPENAI_API_KEY")),
            anthropic_api_key=_optional(values.get("ANTHROPIC_API_KEY")),
            google_api_key=_optional(values.get("GOOGLE_API_KEY")),
            groq_api_key=_optional(values.get("GROQ_API_KEY")),
            openai_text_model=_value(values, "OPENAI_TEXT_MODEL", "gpt-4o"),
            openai_vision_model=_value(values, "OPENAI_VISION_MODEL", "gpt-4o"),
            openai_transcription_model=_value(
                values, "OPENAI_TRANSCRIPTION_MODEL", "whisper-1"
            ),
            anthropic_text_model=_value(
                values, "ANTHROPIC_TEXT_MODEL", "claude-sonnet-5"
            ),
            anthropic_vision_model=_value(
                values, "ANTHROPIC_VISION_MODEL", "claude-sonnet-5"
            ),
            google_text_model=_value(values, "GOOGLE_TEXT_MODEL", "gemini-3.7-flash"),
            google_vision_model=_value(
                values, "GOOGLE_VISION_MODEL", "gemini-3.7-flash"
            ),
            groq_transcription_model=_value(
                values, "GROQ_TRANSCRIPTION_MODEL", "whisper-large-v3"
            ),
            timeout_seconds=_positive_float(
                values.get("TOOLREGISTRY_TIMEOUT_SECONDS"), 120.0
            ),
            max_retries=_non_negative_int(values.get("TOOLREGISTRY_MAX_RETRIES"), 1),
            max_output_tokens=_positive_int(
                values.get("TOOLREGISTRY_MAX_OUTPUT_TOKENS"), 1024
            ),
        )


def _optional(value: str | None) -> str | None:
    return value.strip() or None if value is not None else None


def _value(values: Mapping[str, str], name: str, default: str) -> str:
    return values.get(name, "").strip() or default


def _positive_float(value: str | None, default: float) -> float:
    try:
        parsed = float(value) if value is not None else default
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def _positive_int(value: str | None, default: int) -> int:
    try:
        parsed = int(value) if value is not None else default
    except ValueError:
        return default
    return parsed if parsed > 0 else default


def _non_negative_int(value: str | None, default: int) -> int:
    try:
        parsed = int(value) if value is not None else default
    except ValueError:
        return default
    return parsed if parsed >= 0 else default
