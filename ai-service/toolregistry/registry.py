"""
ToolRegistry : point d'entrée unique utilisé par le reste de l'application
(endpoints /api/devis/*). Route chaque appel vers le bon adapter selon la
config, avec fallback automatique en cas d'échec du provider principal.

Exigence CDC : "couche d'abstraction unifiée qui permet de basculer entre
OpenAI et Anthropic sans modifier le code métier."
"""
from typing import Optional

from .base import DevisGenerationResult, PhotoAnalysisResult, TranscriptionResult
from .config import ModelChoice, ToolRegistryConfig
from .exceptions import AllProvidersFailedError, ToolRegistryError
from .anthropic_adapter import AnthropicAdapter
from .google_adapter import GoogleAdapter
from .openai_adapter import OpenAIAdapter

_MODEL_ATTR_FOR_METHOD = {
    "generate_devis_from_text": "text_model",
    "analyze_photo": "vision_model",
}


class ToolRegistry:
    """
    Façade unique du système multi-provider : basculer de provider = changer
    la config (variables d'environnement), jamais le code métier qui appelle
    generate_devis_from_text() / analyze_photo() / transcribe_audio().
    """

    def __init__(self, config: Optional[ToolRegistryConfig] = None):
        self.config = config or ToolRegistryConfig()
        self._adapters: dict = {}

    def _get_adapter(self, provider: str):
        """Instancie l'adapter à la demande (lazy) et le met en cache."""
        if provider in self._adapters:
            return self._adapters[provider]

        if provider == "openai":
            adapter = OpenAIAdapter(
                api_key=self.config.openai_api_key,
                timeout_seconds=self.config.timeout_seconds,
            )
        elif provider == "anthropic":
            adapter = AnthropicAdapter(
                api_key=self.config.anthropic_api_key,
                timeout_seconds=self.config.timeout_seconds,
            )
        elif provider == "google":
            adapter = GoogleAdapter(
                api_key=self.config.google_api_key,
                timeout_seconds=self.config.timeout_seconds,
            )
        else:
            raise ToolRegistryError(f"Provider inconnu : '{provider}'")

        self._adapters[provider] = adapter
        return adapter

    def generate_devis_from_text(
        self,
        description: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 8192,
    ) -> DevisGenerationResult:
        return self._call_with_fallback(
            "generate_devis_from_text",
            self.config.texte_choice(),
            self.config.texte_fallback_choice(),
            description=description,
            system_prompt=system_prompt,
            max_tokens=max_tokens,
        )

    def analyze_photo(
        self,
        image_base64: str,
        prompt: Optional[str] = None,
    ) -> PhotoAnalysisResult:
        return self._call_with_fallback(
            "analyze_photo",
            self.config.vision_choice(),
            self.config.vision_fallback_choice(),
            image_base64=image_base64,
            prompt=prompt,
        )

    def transcribe_audio(
        self,
        audio_bytes: bytes,
        audio_format: str = "wav",
    ) -> TranscriptionResult:
        # Pas de fallback pour la transcription : un seul provider (OpenAI/Whisper)
        # l'implémente réellement dans le périmètre du CDC actuel.
        choice = self.config.transcription_choice()
        adapter = self._get_adapter(choice.provider)
        return adapter.transcribe_audio(audio_bytes, audio_format)

    def _call_with_fallback(
        self,
        method_name: str,
        primary: ModelChoice,
        fallback: Optional[ModelChoice],
        **kwargs,
    ):
        """
        Essaie le provider principal ; si ToolRegistryError (timeout ou erreur API),
        bascule sur le fallback configuré. Si les deux échouent, lève
        AllProvidersFailedError avec le détail de chaque tentative.
        """
        attempts = []
        model_attr = _MODEL_ATTR_FOR_METHOD[method_name]

        for choice in filter(None, [primary, fallback]):
            adapter = self._get_adapter(choice.provider)
            setattr(adapter, model_attr, choice.model)
            try:
                return getattr(adapter, method_name)(**kwargs)
            except ToolRegistryError as e:
                attempts.append(
                    {"provider": choice.provider, "model": choice.model, "error": str(e)}
                )
                continue

        raise AllProvidersFailedError(attempts)
