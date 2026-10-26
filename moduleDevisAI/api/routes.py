from __future__ import annotations

import base64
import binascii
import json
import logging
import os
from typing import Any, Literal

import psycopg
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from catalog import HybridCatalogueRetriever
from catalog.embeddings import EmbeddingGemmaProvider
from devis import CataloguePricingRepository, QuoteFinancialService, QuoteSnapshotRepository
from devis import llm_select_candidates, select_grounded_candidates
from devis.text import display_text
from toolregistry import AudioInput, ImageInput, ToolRegistry, ToolRegistryConfig, TranscriptionRequest, VisionAnalysisRequest

from .prompt_loader import load_system_prompt

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_AUDIO_BYTES = 25 * 1024 * 1024
TRANSCRIPTION_MODELS: dict[str, set[str]] = {
    "openai": {"whisper-1"},
    "groq": {"whisper-large-v3", "whisper-large-v3-turbo"},
}
TEXT_MODELS: dict[str, set[str]] = {
    "openai": {"gpt-4o", "gpt-4o-mini"},
    "anthropic": {"claude-sonnet-5"},
    "google": {
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.6-flash",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
    },
}
VISION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "description_scene": {"type": ["string", "null"]},
        "type_scene": {"type": ["string", "null"]},
        "type_piece_ou_zone": {"type": ["string", "null"]},
        "surface_estimee_m2": {"type": ["number", "null"]},
        "reference_dimensionnelle_visible": {"type": "boolean"},
        "materiaux_visibles": {"type": "array", "items": {"type": "string"}},
        "elements_visibles": {"type": "array", "items": {"type": "string"}},
        "observations_etat": {"type": "array", "items": {"type": "string"}},
        "incertitudes": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "description_scene", "type_scene", "type_piece_ou_zone", "surface_estimee_m2",
        "reference_dimensionnelle_visible", "materiaux_visibles", "elements_visibles",
        "observations_etat", "incertitudes",
    ],
}


class ImagePayload(BaseModel):
    media_type: Literal["image/jpeg", "image/png", "image/gif", "image/webp"]
    data_base64: str | None = Field(default=None, max_length=14_000_000)
    url: str | None = Field(default=None, max_length=4_000)


class AudioPayload(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    media_type: str | None = Field(default=None, max_length=127)
    data_base64: str = Field(min_length=1, max_length=35_000_000)


class MatchRequest(BaseModel):
    company_id: int = Field(gt=0, description="Injected by authenticated gateway in production.")
    description_libre: str = Field(default="", max_length=4000)
    modalite_source: Literal["texte", "text", "audio", "image"] = "texte"
    provider: Literal["openai", "anthropic", "google"] | None = None
    model: str | None = Field(default=None, max_length=100)
    image: ImagePayload | None = None
    audio: AudioPayload | None = None


def connection() -> psycopg.Connection[Any]:
    return psycopg.connect(os.environ["DATABASE_URL"])


def _decode_base64(value: str, maximum_size: int, field_name: str) -> bytes:
    try:
        decoded = base64.b64decode(value, validate=True)
    except (ValueError, binascii.Error) as error:
        raise ValueError(f"{field_name} must be valid base64.") from error
    if not decoded:
        raise ValueError(f"{field_name} must not be empty.")
    if len(decoded) > maximum_size:
        raise ValueError(f"{field_name} exceeds the maximum accepted size.")
    return decoded


def _capability_registry(setting: str) -> ToolRegistry:
    provider = os.getenv(setting)
    if not provider and setting == "AUDIO_TOOLREGISTRY_PROVIDER":
        if os.getenv("GROQ_API_KEY"):
            provider = "groq"
        elif os.getenv("OPENAI_API_KEY"):
            provider = "openai"
    if not provider:
        return ToolRegistry()
    values = dict(os.environ)
    values["TOOLREGISTRY_PROVIDER"] = provider
    return ToolRegistry(ToolRegistryConfig.from_env(values))


def _transcription_registry(provider: str | None, model: str | None) -> ToolRegistry:
    """Build a registry from an allowlisted UI selection; credentials stay server-side."""
    if not provider and not model:
        return _capability_registry("AUDIO_TOOLREGISTRY_PROVIDER")

    selected_provider = (provider or "").strip().lower()
    if selected_provider not in TRANSCRIPTION_MODELS:
        raise ValueError("provider must be 'openai' or 'groq' for transcription.")
    selected_model = (model or "").strip()
    if selected_model not in TRANSCRIPTION_MODELS[selected_provider]:
        raise ValueError("The selected model is not supported by this transcription provider.")

    values = dict(os.environ)
    values["TOOLREGISTRY_PROVIDER"] = selected_provider
    values[
        "OPENAI_TRANSCRIPTION_MODEL" if selected_provider == "openai" else "GROQ_TRANSCRIPTION_MODEL"
    ] = selected_model
    return ToolRegistry(ToolRegistryConfig.from_env(values))


def _text_generation_registry(provider: str | None, model: str | None) -> ToolRegistry:
    """Build a registry from an allowlisted text-model selection."""
    if not provider and not model:
        return ToolRegistry()

    selected_provider = (provider or "").strip().lower()
    selected_model = (model or "").strip()
    if selected_provider not in TEXT_MODELS:
        raise ValueError("Unsupported text generation provider.")
    if selected_model not in TEXT_MODELS[selected_provider]:
        raise ValueError("The selected model is not supported by this provider.")

    model_setting = {
        "openai": "OPENAI_TEXT_MODEL",
        "anthropic": "ANTHROPIC_TEXT_MODEL",
        "google": "GOOGLE_TEXT_MODEL",
    }[selected_provider]
    values = dict(os.environ)
    values["TOOLREGISTRY_PROVIDER"] = selected_provider
    values[model_setting] = selected_model
    return ToolRegistry(ToolRegistryConfig.from_env(values))

def _parse_structured_vision(content: str) -> dict[str, Any]:
    value = content.strip()
    if value.startswith("```") and value.endswith("```"):
        parts = value.split("\n", 1)
        value = parts[1].rsplit("\n", 1)[0] if len(parts) == 2 else ""
    try:
        payload = json.loads(value)
    except json.JSONDecodeError:
        start = value.find("{")
        if start < 0:
            raise ValueError("The vision model returned invalid structured JSON.") from None
        try:
            payload, _ = json.JSONDecoder().raw_decode(value[start:])
        except json.JSONDecodeError as error:
            raise ValueError("The vision model returned invalid structured JSON.") from error
    if not isinstance(payload, dict):
        raise ValueError("The vision model response must be a JSON object.")
    return payload


def _model_trace(result: Any) -> dict[str, Any]:
    metadata = getattr(result, "metadata", {})
    model_version = metadata.get("model_version") if isinstance(metadata, dict) else None
    return {
        "provider": getattr(result, "provider", None),
        "model": getattr(result, "model", None),
        "model_version": model_version,
        "request_id": getattr(result, "request_id", None),
    }


def _enrich_description(request: MatchRequest) -> tuple[str, dict[str, Any], dict[str, Any] | None]:
    description = request.description_libre.strip()
    if request.modalite_source in ("texte", "text"):
        if not description:
            raise ValueError("description_libre is required when modalite_source is texte.")
        return description, {"source": "texte"}, None
    if request.modalite_source == "audio":
        if request.audio is None:
            raise ValueError("audio is required when modalite_source is audio.")
        audio = request.audio
        transcription = _capability_registry("AUDIO_TOOLREGISTRY_PROVIDER").transcription.transcribe_audio(
            TranscriptionRequest(audio=AudioInput(data=_decode_base64(audio.data_base64, MAX_AUDIO_BYTES, "audio.data_base64"), filename=audio.filename, media_type=audio.media_type), language="fr", prompt=load_system_prompt("audio_transcription_prompt.txt"))
        )
        combined = "\n\n".join(part for part in (description, transcription.text.strip()) if part)
        return combined, {"source": "audio", "transcription": _model_trace(transcription)}, None
    if request.image is None:
        raise ValueError("image is required when modalite_source is image.")
    image = request.image
    if (image.data_base64 is None) == (image.url is None):
        raise ValueError("image requires exactly one of data_base64 or url.")
    image_input = ImageInput(media_type=image.media_type, data=_decode_base64(image.data_base64, MAX_IMAGE_BYTES, "image.data_base64") if image.data_base64 is not None else None, url=image.url)
    vision = _capability_registry("VISION_TOOLREGISTRY_PROVIDER").vision.analyze_photo(
        VisionAnalysisRequest(image=image_input, prompt="Analyse cette image conformément aux instructions système.", system_prompt=load_system_prompt("vision_analysis_system_prompt.txt"), response_mime_type="application/json", response_json_schema=VISION_SCHEMA)
    )
    analysis = _parse_structured_vision(vision.content)
    combined = "\n\n".join(part for part in (description, "Analyse visuelle structurée : " + json.dumps(analysis, ensure_ascii=False)) if part)
    return combined, {"source": "image", "vision": _model_trace(vision)}, analysis


@router.get("/api/v1/catalogue/prestations")
def list_catalogue_prestations(company_id: int) -> dict[str, Any]:
    """List active prestation choices for one tenant only.

    A production gateway must inject ``company_id`` from the authenticated user.
    """
    if company_id <= 0:
        raise HTTPException(422, "company_id must be positive.")
    try:
        items = CataloguePricingRepository(connection).list_prestations(company_id)
        return {"items": [{"catalogue_item_id": item["id"], "sku_catalogue": item["sku_catalogue"], "label": display_text(item["label"]), "unite": item["unite"], "prix_unitaire": float(item["unit_sale_price"]), "cout_unitaire": float(item["unit_cost"])} for item in items]}
    except KeyError as error:
        raise HTTPException(503, "DATABASE_URL absent.") from error


@router.get("/api/v1/catalogue/components")
def list_catalogue_components(company_id: int) -> dict[str, Any]:
    """List active material and labour choices for quote composition editing."""
    if company_id <= 0:
        raise HTTPException(422, "company_id must be positive.")
    try:
        items = CataloguePricingRepository(connection).list_components(company_id)
        return {
            "items": [
                {
                    "catalogue_item_id": item["id"],
                    "sku_catalogue": item["sku_catalogue"],
                    "label": display_text(item["label"]),
                    "item_type": item["item_type"],
                    "unite": item["unite"],
                    "cout_unitaire": float(item["unit_cost"]),
                }
                for item in items
            ]
        }
    except KeyError as error:
        raise HTTPException(503, "DATABASE_URL absent.") from error


@router.post("/api/v1/devis/vocal-transcribe")
async def vocal_transcribe(
    audio: UploadFile = File(...),
    provider: str | None = Form(default=None),
    model: str | None = Form(default=None),
    duration_seconds: float | None = Form(default=None, ge=0, le=60 * 60),
) -> dict[str, Any]:
    try:
        content = await audio.read(MAX_AUDIO_BYTES + 1)
        if not content:
            raise ValueError("audio must not be empty.")
        if len(content) > MAX_AUDIO_BYTES:
            raise ValueError("audio exceeds the maximum accepted size.")
        transcription = _transcription_registry(provider, model).transcription.transcribe_audio(
            TranscriptionRequest(
                audio=AudioInput(
                    data=content,
                    filename=audio.filename or "enregistrement.wav",
                    media_type=audio.content_type,
                ),
                language="fr",
                prompt=load_system_prompt("audio_transcription_prompt.txt"),
            )
        )
        provider_duration = transcription.metadata.get("duration")
        duration = (
            provider_duration
            if isinstance(provider_duration, (int, float))
            else duration_seconds
        )
        return {
            "transcription_texte": transcription.text,
            "duration_seconds": duration,
            "provider": transcription.provider,
            "model": transcription.model,
        }
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except Exception as error:
        logger.exception("Audio transcription request failed.")
        raise HTTPException(503, "Service de transcription indisponible.") from error


@router.post("/api/v1/devis/match-catalogue")
def match_catalogue(request: MatchRequest) -> dict[str, Any]:
    try:
        query, _, _ = _enrich_description(request)
        candidates = HybridCatalogueRetriever(connection, EmbeddingGemmaProvider()).search(request.company_id, query, limit=int(os.getenv("CATALOGUE_RETRIEVAL_LIMIT", "24")))
        grounded, assumptions = select_grounded_candidates(candidates, query)
        matches = [item for item in grounded if item["item_type"] == "prestation"]
        if grounded and not matches:
            assumptions.append("Aucune prestation exploitable n'a été trouvée dans le catalogue.")
        model_quantities = None
        model_confidences: dict[int, float] = {}
        model_trace = None
        use_llm = os.getenv("CATALOGUE_USE_LLM", "true").lower() in ("1", "true", "yes")
        if use_llm and matches:
            try:
                matches, model_quantities, model_confidences, uncovered, model_trace = llm_select_candidates(
                    query,
                    matches,
                    _text_generation_registry(request.provider, request.model),
                )
                assumptions.extend(
                    f"Élément demandé non couvert par le catalogue : {item}."
                    for item in uncovered
                )
            except ValueError as error:
                # Never price an invalid model selection, but keep the retrieved
                # prestations available to the editor instead of failing the quote.
                logger.warning("Catalogue model selection rejected: %s", error)
                assumptions.append(
                    "La sélection automatique doit être vérifiée. Choisissez les prestations dans le catalogue."
                )
                matches = []
                model_quantities = {}
        elif matches:
            assumptions.append("Sélection de devis indisponible : active CATALOGUE_USE_LLM.")
            matches = []
        quantities = model_quantities or {}
        catalogue_pricing = CataloguePricingRepository(connection)
        priced_by_id = {item["id"]: item for item in catalogue_pricing.load_prestations(request.company_id, list(quantities))}
        priced_matches: list[dict[str, Any]] = []
        for item_id in quantities:
            if item_id not in priced_by_id:
                raise ValueError("Une prestation sélectionnée est indisponible dans le catalogue.")
            priced_item = priced_by_id[item_id]
            priced_item["selection_confidence"] = model_confidences[item_id]
            priced_matches.append(priced_item)
        result = QuoteFinancialService().calculate(priced_matches, quantities)
        if request.modalite_source == "image":
            result["alertes"].append("Les observations image exigent confirmation client.")
        QuoteSnapshotRepository(connection).save(request.company_id, query, result)
        return {
            "lines": result["lines"],
            "alertes": result["alertes"],
            "assumptions": assumptions,
            "model_trace": (
                {
                    "provider": model_trace["provider"],
                    "model": model_trace["model"],
                    "model_version": model_trace["model_version"],
                }
                if model_trace
                else None
            ),
        }
    except KeyError as error:
        if error.args == ("DATABASE_URL",):
            raise HTTPException(503, "DATABASE_URL absent.") from error
        logger.exception("Catalogue matching failed because of a missing result field.")
        raise HTTPException(503, "Service de matching catalogue indisponible.") from error
    except ValueError as error:
        logger.warning("Catalogue matching request rejected: %s", error)
        raise HTTPException(422, str(error)) from error
    except Exception as error:
        logger.exception("Catalogue matching request failed.")
        raise HTTPException(503, "Service de matching catalogue indisponible.") from error
