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


class GoogleAdapter(ProviderAdapter, BaseTextModel, BaseVisionModel, BaseTranscriptionModel):

    def __init__(self, config: ToolRegistryConfig, client: Any | None = None) -> None:
        ProviderAdapter.__init__(self, "google")
        BaseTextModel.__init__(self)
        BaseVisionModel.__init__(self)
        BaseTranscriptionModel.__init__(self)
        self._config = config
        self._client = client

    def generate_devis_from_text(self, request: TextGenerationRequest) -> GeneratedContent:
        model = self._config.google_text_model
        response = self._call(
            "generate_devis_from_text",
            model,
            lambda: self._client_or_raise().models.generate_content(
                model=model,
                contents=self._input_with_system_prompt(request.system_prompt, request.text),
                config={
                    "max_output_tokens": request.max_output_tokens
                    or self._config.max_output_tokens,
                },
            ),
        )
        return self._generated_content(response, model, "generate_devis_from_text")

    def analyze_photo(self, request: VisionAnalysisRequest) -> GeneratedContent:
        model = self._config.google_vision_model
        if request.image.url is not None:
            image_content = {
                "file_data": {
                    "mime_type": request.image.media_type,
                    "file_uri": request.image.url,
                }
            }
        else:
            image_content = {
                "inline_data": {
                    "mime_type": request.image.media_type,
                    "data": base64.b64encode(request.image.data or b"").decode("ascii"),
                }
            }
        generation_config: dict[str, Any] = {
            "max_output_tokens": request.max_output_tokens
            or self._config.max_output_tokens,
        }
        if request.temperature is not None:
            generation_config["temperature"] = request.temperature
        if request.response_mime_type is not None:
            generation_config["response_mime_type"] = request.response_mime_type
        if request.response_json_schema is not None:
            generation_config["response_json_schema"] = dict(request.response_json_schema)

        response = self._call(
            "analyze_photo",
            model,
            lambda: self._client_or_raise().models.generate_content(
                model=model,
                contents=[
                    image_content,
                    {"text": self._input_with_system_prompt(request.system_prompt, request.prompt)},
                ],
                config=generation_config,
            ),
        )
        return self._generated_content(response, model, "analyze_photo")

    def transcribe_audio(self, request: TranscriptionRequest) -> TranscriptionResult:
        del request
        raise UnsupportedCapabilityError(
            "Google's Gemini interactions API does not provide speech-to-text "
            "transcription through this adapter.",
            provider="google",
            operation="transcribe_audio",
        )

    def _client_or_raise(self) -> Any:
        if self._client is not None:
            return self._client
        if not self._config.google_api_key:
            raise ProviderAuthenticationError(
                "GOOGLE_API_KEY is not configured.", provider="google"
            )
        try:
            from google import genai
        except ImportError as error:
            raise ProviderAuthenticationError(
                "The official 'google-genai' package is required; install "
                "requirements.txt.",
                provider="google",
            ) from error
        self._client = genai.Client(
            api_key=self._config.google_api_key,
            http_options=genai.types.HttpOptions(
                timeout=round(self._config.timeout_seconds * 1_000),
                retry_options=genai.types.HttpRetryOptions(
                    attempts=self._config.max_retries + 1,
                ),
            ),
        )
        return self._client

    @staticmethod
    def _input_with_system_prompt(system_prompt: str | None, prompt: str) -> str:
        if not system_prompt:
            return prompt
        return f"System instructions:\n{system_prompt}\n\nUser request:\n{prompt}"

    def _generated_content(self, response: Any, model: str, operation: str) -> GeneratedContent:
        content = getattr(response, "text", None)
        if not isinstance(content, str) or not content.strip():
            content = getattr(response, "output_text", None)

        if not isinstance(content, str) or not content.strip():
            candidates = getattr(response, "candidates", None) or []
            for candidate in candidates:
                parts = getattr(candidate, "content", None)
                parts = getattr(parts, "parts", None) if parts is not None else None
                if not parts:
                    continue
                for part in parts:
                    part_text = getattr(part, "text", None)
                    if isinstance(part_text, str) and part_text.strip():
                        content = part_text
                        break
                if isinstance(content, str) and content.strip():
                    break

        if not isinstance(content, str) or not content.strip():
            raise ProviderResponseError(
                "Google returned no text output.",
                provider="google",
                operation=operation,
                request_id=getattr(response, "_request_id", None),
            )
        usage_metadata = getattr(response, "usage_metadata", None)
        usage_payload: dict[str, Any] | None = None
        if usage_metadata is not None:
            if hasattr(usage_metadata, "model_dump"):
                usage_payload = usage_metadata.model_dump(mode="json", exclude_none=True)
            elif hasattr(usage_metadata, "to_json_dict"):
                usage_payload = usage_metadata.to_json_dict()
            elif isinstance(usage_metadata, dict):
                usage_payload = usage_metadata

        metadata: dict[str, Any] = {}
        if usage_payload is not None:
            metadata["usage_metadata"] = usage_payload
        model_version = getattr(response, "model_version", None)
        if isinstance(model_version, str) and model_version:
            metadata["model_version"] = model_version

        return GeneratedContent(
            content=content,
            provider="google",
            model=model,
            request_id=getattr(response, "_request_id", None),
            metadata=metadata,
        )
