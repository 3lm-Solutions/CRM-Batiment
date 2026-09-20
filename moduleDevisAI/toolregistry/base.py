from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Literal

ProviderName = Literal["openai", "anthropic", "google", "groq"]


@dataclass(frozen=True, slots=True)
class TextGenerationRequest:

    text: str # Prompt
    system_prompt: str | None = None
    max_output_tokens: int | None = None


@dataclass(frozen=True, slots=True)
class ImageInput:

    media_type: Literal["image/jpeg", "image/png", "image/gif", "image/webp"]
    data: bytes | None = None
    url: str | None = None

    def __post_init__(self) -> None:
        if (self.data is None) == (self.url is None):
            raise ValueError("ImageInput requires exactly one of data or url.")
        if self.url is not None and not self.url.startswith(("https://", "http://")):
            raise ValueError("ImageInput.url must be an HTTP(S) URL.")


@dataclass(frozen=True, slots=True)
class VisionAnalysisRequest:

    image: ImageInput
    prompt: str
    system_prompt: str | None = None
    max_output_tokens: int | None = None


@dataclass(frozen=True, slots=True)
class AudioInput:

    data: bytes
    filename: str
    media_type: str | None = None

    def __post_init__(self) -> None:
        if not self.data:
            raise ValueError("AudioInput.data must not be empty.")
        if not self.filename.strip():
            raise ValueError("AudioInput.filename must not be empty.")


@dataclass(frozen=True, slots=True)
class TranscriptionRequest:

    audio: AudioInput
    language: str | None = None
    prompt: str | None = None


@dataclass(frozen=True, slots=True)
class GeneratedContent:

    content: str
    provider: ProviderName
    model: str
    request_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class TranscriptionResult:

    text: str
    provider: ProviderName
    model: str
    request_id: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseTextModel(ABC):

    def __init__(self) -> None:
        if type(self) is BaseTextModel:
            raise TypeError("BaseTextModel is abstract and cannot be instantiated.")

    @abstractmethod
    def generate_devis_from_text(
        self, request: TextGenerationRequest
    ) -> GeneratedContent:
        """Generate text from a prompt and return normalized textual content."""


class BaseVisionModel(ABC):

    def __init__(self) -> None:
        if type(self) is BaseVisionModel:
            raise TypeError("BaseVisionModel is abstract and cannot be instantiated.")

    @abstractmethod
    def analyze_photo(self, request: VisionAnalysisRequest) -> GeneratedContent:
        """Analyse a photo and return normalized textual content."""


class BaseTranscriptionModel(ABC):

    def __init__(self) -> None:
        if type(self) is BaseTranscriptionModel:
            raise TypeError(
                "BaseTranscriptionModel is abstract and cannot be instantiated."
            )

    @abstractmethod
    def transcribe_audio(self, request: TranscriptionRequest) -> TranscriptionResult:
        """Transcribe an audio input or raise UnsupportedCapabilityError."""
