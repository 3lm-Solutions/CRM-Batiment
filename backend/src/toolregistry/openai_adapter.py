from __future__ import annotations

import base64
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
from .errors import ProviderAuthenticationError, ProviderResponseError


class OpenAIAdapter(ProviderAdapter, BaseTextModel, BaseVisionModel, BaseTranscriptionModel):

    def __init__(self, config: ToolRegistryConfig, client: Any | None = None) -> None:
        ProviderAdapter.__init__(self, "openai")
        BaseTextModel.__init__(self)
        BaseVisionModel.__init__(self)
        BaseTranscriptionModel.__init__(self)
        self._config = config
        self._client = client

    def generate_devis_from_text(self, request: TextGenerationRequest) -> GeneratedContent:
        model = self._config.openai_text_model
        response = self._call(
            "generate_devis_from_text",
            model,
            lambda: self._client_or_raise().responses.create(
                model=model,
                instructions=request.system_prompt,
                input=[
                    {
                        "role": "user",
                        "content": [{"type": "input_text", "text": request.text}],
                    }
                ],
                max_output_tokens=request.max_output_tokens
                or self._config.max_output_tokens,
            ),
        )
        return self._generated_content(response, model, "generate_devis_from_text")

    def analyze_photo(self, request: VisionAnalysisRequest) -> GeneratedContent:
        model = self._config.openai_vision_model
        image_url = request.image.url or (
            f"data:{request.image.media_type};base64,"
            f"{base64.b64encode(request.image.data or b'').decode('ascii')}"
        )
        response = self._call(
            "analyze_photo",
            model,
            lambda: self._client_or_raise().responses.create(
                model=model,
                instructions=request.system_prompt,
                input=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "input_image", "image_url": image_url},
                            {"type": "input_text", "text": request.prompt},
                        ],
                    }
                ],
                max_output_tokens=request.max_output_tokens
                or self._config.max_output_tokens,
            ),
        )
        return self._generated_content(response, model, "analyze_photo")

    def transcribe_audio(self, request: TranscriptionRequest) -> TranscriptionResult:
        model = self._config.openai_transcription_model
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
                "OpenAI returned no transcription text.",
                provider="openai",
                operation="transcribe_audio",
                request_id=getattr(response, "_request_id", None),
            )
        return TranscriptionResult(
            text=text,
            provider="openai",
            model=model,
            request_id=getattr(response, "_request_id", None),
        )

    def _client_or_raise(self) -> Any:
        if self._client is not None:
            return self._client
        if not self._config.openai_api_key:
            raise ProviderAuthenticationError(
                "OPENAI_API_KEY is not configured.", provider="openai"
            )
        try:
            from openai import OpenAI
        except ImportError as error:
            raise ProviderAuthenticationError(
                "The official 'openai' package is required; install "
                "requirements.txt.",
                provider="openai",
            ) from error
        self._client = OpenAI(
            api_key=self._config.openai_api_key,
            timeout=self._config.timeout_seconds,
            max_retries=self._config.max_retries,
        )
        return self._client

    def _generated_content(self, response: Any, model: str, operation: str) -> GeneratedContent:
        content = getattr(response, "output_text", None)
        if not isinstance(content, str) or not content.strip():
            raise ProviderResponseError(
                "OpenAI returned no text output.",
                provider="openai",
                operation=operation,
                request_id=getattr(response, "_request_id", None),
            )
        return GeneratedContent(
            content=content,
            provider="openai",
            model=model,
            request_id=getattr(response, "_request_id", None),
        )
