from __future__ import annotations

import base64
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


class AnthropicAdapter(
    ProviderAdapter, BaseTextModel, BaseVisionModel, BaseTranscriptionModel
):

    def __init__(self, config: ToolRegistryConfig, client: Any | None = None) -> None:
        ProviderAdapter.__init__(self, "anthropic")
        BaseTextModel.__init__(self)
        BaseVisionModel.__init__(self)
        BaseTranscriptionModel.__init__(self)
        self._config = config
        self._client = client

    def generate_devis_from_text(self, request: TextGenerationRequest) -> GeneratedContent:
        model = self._config.anthropic_text_model
        response = self._call(
            "generate_devis_from_text",
            model,
            lambda: self._client_or_raise().messages.create(
                model=model,
                max_tokens=request.max_output_tokens or self._config.max_output_tokens,
                system=request.system_prompt,
                messages=[{"role": "user", "content": request.text}],
            ),
        )
        return self._generated_content(response, model, "generate_devis_from_text")

    def analyze_photo(self, request: VisionAnalysisRequest) -> GeneratedContent:
        model = self._config.anthropic_vision_model
        source: dict[str, str]
        if request.image.url is not None:
            source = {"type": "url", "url": request.image.url}
        else:
            source = {
                "type": "base64",
                "media_type": request.image.media_type,
                "data": base64.b64encode(request.image.data or b"").decode("ascii"),
            }

        response = self._call(
            "analyze_photo",
            model,
            lambda: self._client_or_raise().messages.create(
                model=model,
                max_tokens=request.max_output_tokens or self._config.max_output_tokens,
                system=request.system_prompt,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "image", "source": source},
                            {"type": "text", "text": request.prompt},
                        ],
                    }
                ],
            ),
        )
        return self._generated_content(response, model, "analyze_photo")

    def transcribe_audio(self, request: TranscriptionRequest) -> TranscriptionResult:
        del request
        raise UnsupportedCapabilityError(
            "Anthropic does not provide native speech-to-text transcription via its "
            "public Messages API. Select an OpenAI registry for transcription.",
            provider="anthropic",
            operation="transcribe_audio",
        )

    def _client_or_raise(self) -> Any:
        if self._client is not None:
            return self._client
        if not self._config.anthropic_api_key:
            raise ProviderAuthenticationError(
                "ANTHROPIC_API_KEY is not configured.", provider="anthropic"
            )
        try:
            from anthropic import Anthropic
        except ImportError as error:
            raise ProviderAuthenticationError(
                "The official 'anthropic' package is required; install "
                "requirements.txt.",
                provider="anthropic",
            ) from error
        self._client = Anthropic(
            api_key=self._config.anthropic_api_key,
            timeout=self._config.timeout_seconds,
            max_retries=self._config.max_retries,
        )
        return self._client

    def _generated_content(self, response: Any, model: str, operation: str) -> GeneratedContent:
        text_parts = [
            block.text
            for block in getattr(response, "content", [])
            if getattr(block, "type", None) == "text"
            and isinstance(getattr(block, "text", None), str)
        ]
        content = "\n".join(text_parts).strip()
        if not content:
            raise ProviderResponseError(
                "Anthropic returned no text output.",
                provider="anthropic",
                operation=operation,
                request_id=getattr(response, "_request_id", None),
            )
        return GeneratedContent(
            content=content,
            provider="anthropic",
            model=model,
            request_id=getattr(response, "_request_id", None),
        )
