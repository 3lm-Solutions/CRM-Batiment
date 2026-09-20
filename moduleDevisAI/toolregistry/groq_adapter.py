from __future__ import annotations

from io import BytesIO
from typing import Any

from ._adapter import ProviderAdapter
from .base import (
    BaseTextModel,
    BaseTranscriptionModel,
    BaseVisionModel,
    GeneratedContent,
    TextGenerationRequest,
    TranscriptionRequest,
    TranscriptionResult,
    VisionAnalysisRequest,
)
from .config import ToolRegistryConfig
from .errors import (
    ProviderAuthenticationError,
    ProviderResponseError,
    UnsupportedCapabilityError,
)


class GroqAdapter(
    ProviderAdapter, BaseTextModel, BaseVisionModel, BaseTranscriptionModel
):

    def __init__(self, config: ToolRegistryConfig, client: Any | None = None) -> None:
        ProviderAdapter.__init__(self, "groq")
        BaseTextModel.__init__(self)
        BaseVisionModel.__init__(self)
        BaseTranscriptionModel.__init__(self)
        self._config = config
        self._client = client

    def generate_devis_from_text(self, request: TextGenerationRequest) -> GeneratedContent:
        del request
        raise UnsupportedCapabilityError(
            "Groq is configured for transcription only.",
            provider="groq",
            operation="generate_devis_from_text",
        )

    def analyze_photo(self, request: VisionAnalysisRequest) -> GeneratedContent:
        del request
        raise UnsupportedCapabilityError(
            "Groq is configured for transcription only.",
            provider="groq",
            operation="analyze_photo",
        )

    def transcribe_audio(self, request: TranscriptionRequest) -> TranscriptionResult:
        model = self._config.groq_transcription_model
        audio = request.audio
        audio_file = (audio.filename, BytesIO(audio.data), audio.media_type)
        response = self._call(
            "transcribe_audio",
            model,
            lambda: self._client_or_raise().audio.transcriptions.create(
                model=model,
                file=audio_file,
                language=request.language,
                prompt=request.prompt,
                response_format="json",
            ),
        )
        text = getattr(response, "text", None)
        if not isinstance(text, str) or not text.strip():
            raise ProviderResponseError(
                "Groq returned no transcription text.",
                provider="groq",
                operation="transcribe_audio",
                request_id=getattr(response, "_request_id", None),
            )
        metadata: dict[str, Any] = {}
        duration = getattr(response, "duration", None)
        if isinstance(duration, (int, float)) and duration >= 0:
            metadata["duration"] = float(duration)
        return TranscriptionResult(
            text=text,
            provider="groq",
            model=model,
            request_id=getattr(response, "_request_id", None),
            metadata=metadata,
        )

    def _client_or_raise(self) -> Any:
        if self._client is not None:
            return self._client
        if not self._config.groq_api_key:
            raise ProviderAuthenticationError(
                "GROQ_API_KEY is not configured.", provider="groq"
            )
        try:
            from groq import Groq
        except ImportError as error:
            raise ProviderAuthenticationError(
                "The official 'groq' package is required; install requirements.txt.",
                provider="groq",
            ) from error
        self._client = Groq(
            api_key=self._config.groq_api_key,
            timeout=self._config.timeout_seconds,
            max_retries=self._config.max_retries,
        )
        return self._client