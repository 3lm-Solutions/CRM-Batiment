from __future__ import annotations

from .anthropic_adapter import AnthropicAdapter
from .base import BaseTextModel, BaseTranscriptionModel, BaseVisionModel
from .config import ToolRegistryConfig
from .google_adapter import GoogleAdapter
from .groq_adapter import GroqAdapter
from .openai_adapter import OpenAIAdapter


class ToolRegistry:

    def __init__(
        self,
        config: ToolRegistryConfig | None = None,
        *,
        openai_adapter: OpenAIAdapter | None = None,
        anthropic_adapter: AnthropicAdapter | None = None,
        google_adapter: GoogleAdapter | None = None,
        groq_adapter: GroqAdapter | None = None,
    ) -> None:
        self.config = config or ToolRegistryConfig.from_env()
        adapters = {
            "openai": openai_adapter or OpenAIAdapter(self.config),
            "anthropic": anthropic_adapter or AnthropicAdapter(self.config),
            "google": google_adapter or GoogleAdapter(self.config),
            "groq": groq_adapter or GroqAdapter(self.config),
        }
        self._adapter = adapters[self.config.provider]

    @property
    def text(self) -> BaseTextModel:
        return self._adapter

    @property
    def vision(self) -> BaseVisionModel:
        return self._adapter

    @property
    def transcription(self) -> BaseTranscriptionModel:
        return self._adapter
