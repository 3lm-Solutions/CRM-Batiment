"""
Adapter Google Gemini : texte + vision, via l'API gratuite (free tier)
Google AI Studio.

Ajouté en plus des providers exigés par le CDC (OpenAI, Anthropic) — décision
prise avec l'utilisateur : "Garder OpenAI + Anthropic comme exigé, ajouter des
adapters gratuits en plus comme candidats supplémentaires." Gemini 2.0 Flash
est de toute façon déjà cité comme candidat de benchmark dans le CDC lui-même
(section 3.2), donc son adapter sert les deux objectifs à la fois.
"""
import base64
import json
from typing import Optional

from google import genai
from google.genai import types as genai_types
from google.genai.errors import ClientError, ServerError

from .base import BaseTextModel, BaseVisionModel, DevisGenerationResult, PhotoAnalysisResult
from .exceptions import ProviderTimeoutError, ProviderAPIError
from .logging_utils import log_api_call

DEFAULT_TIMEOUT_SECONDS = 30.0
DEFAULT_TEXT_MODEL = "gemini-2.0-flash"
DEFAULT_VISION_MODEL = "gemini-2.0-flash"


class GoogleAdapter(BaseTextModel, BaseVisionModel):
    """
    Adapter Google Gemini (SDK google-genai, successeur du google-generativeai
    déprécié), mêmes signatures que les autres adapters.
    Le free tier Gemini a ses propres limites de débit (rate limits) — à garder
    en tête si le benchmark_texte.py boucle vite sur les 20 cas.
    """

    def __init__(
        self,
        api_key: str,
        text_model: str = DEFAULT_TEXT_MODEL,
        vision_model: str = DEFAULT_VISION_MODEL,
        timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
    ):
        # http_options.timeout est en millisecondes dans google-genai.
        self._client = genai.Client(
            api_key=api_key,
            http_options=genai_types.HttpOptions(timeout=int(timeout_seconds * 1000)),
        )
        self.text_model = text_model
        self.vision_model = vision_model
        self.timeout_seconds = timeout_seconds

    def generate_devis_from_text(
        self,
        description: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 8192,
    ) -> DevisGenerationResult:
        with log_api_call("google", self.text_model, "texte") as ctx:
            try:
                response = self._client.models.generate_content(
                    model=self.text_model,
                    contents=description,
                    config=genai_types.GenerateContentConfig(
                        system_instruction=system_prompt or "",
                        max_output_tokens=max_tokens,
                        response_mime_type="application/json",
                        automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(
                            disable=True
                        ),
                    ),
                )
            except TimeoutError as e:
                raise ProviderTimeoutError("google", self.text_model, self.timeout_seconds) from e
            except (ClientError, ServerError) as e:
                raise ProviderAPIError("google", self.text_model, e) from e

            usage = response.usage_metadata
            tokens_in = getattr(usage, "prompt_token_count", None) if usage else None
            tokens_out = getattr(usage, "candidates_token_count", None) if usage else None
            ctx["tokens_input"] = tokens_in
            ctx["tokens_output"] = tokens_out
            ctx["cout_estime_usd"] = 0.0  # free tier
            raw_json = _parse_json_response(response, "google", self.text_model)

            return DevisGenerationResult(
                raw_json=raw_json,
                provider="google",
                model=self.text_model,
                latence_ms=ctx.get("latence_ms", 0.0),
                tokens_input=tokens_in,
                tokens_output=tokens_out,
                cout_estime_usd=0.0,
            )

    def analyze_photo(
        self,
        image_base64: str,
        prompt: Optional[str] = None,
    ) -> PhotoAnalysisResult:
        with log_api_call("google", self.vision_model, "photo") as ctx:
            try:
                response = self._client.models.generate_content(
                    model=self.vision_model,
                    contents=[
                        genai_types.Part.from_bytes(
                            data=base64.b64decode(image_base64),
                            mime_type="image/jpeg",
                        ),
                        prompt or "",
                    ],
                    config=genai_types.GenerateContentConfig(
                        max_output_tokens=800,
                        response_mime_type="application/json",
                        automatic_function_calling=genai_types.AutomaticFunctionCallingConfig(
                            disable=True
                        ),
                    ),
                )
            except TimeoutError as e:
                raise ProviderTimeoutError("google", self.vision_model, self.timeout_seconds) from e
            except (ClientError, ServerError) as e:
                raise ProviderAPIError("google", self.vision_model, e) from e

            usage = response.usage_metadata
            tokens_in = getattr(usage, "prompt_token_count", None) if usage else None
            tokens_out = getattr(usage, "candidates_token_count", None) if usage else None
            raw_json = _parse_json_response(response, "google", self.vision_model)

            return PhotoAnalysisResult(
                type_piece=raw_json.get("type_piece"),
                surface_estimee_m2=raw_json.get("surface_estimee_m2"),
                materiaux_identifies=raw_json.get("materiaux_identifies", []),
                reference_visible=raw_json.get("reference_visible"),
                raw_json=raw_json,
                provider="google",
                model=self.vision_model,
                latence_ms=ctx.get("latence_ms", 0.0),
                tokens_input=tokens_in,
                tokens_output=tokens_out,
                cout_estime_usd=0.0,
            )


def _parse_json_response(response, provider: str, model: str) -> dict:
    text = (getattr(response, "text", None) or "").strip()
    finish_reason = None
    candidates = getattr(response, "candidates", None) or []
    if candidates:
        finish_reason = str(getattr(candidates[0], "finish_reason", "") or "")

    if not text:
        raise ProviderAPIError(
            provider,
            model,
            ValueError(f"Réponse vide (finish_reason={finish_reason or 'inconnu'})"),
        )
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        truncated = "MAX_TOKENS" in finish_reason.upper() if finish_reason else False
        detail = (
            "JSON tronqué par max_output_tokens"
            if truncated
            else f"JSON invalide: {exc}"
        )
        raise ProviderAPIError(provider, model, ValueError(detail)) from exc
