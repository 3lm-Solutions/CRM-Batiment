from __future__ import annotations

import base64
import binascii
import json
import logging
import os
from typing import Any, Literal

import psycopg
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from catalog import HybridCatalogueRetriever
from catalog.embeddings import EmbeddingGemmaProvider
from devis import CataloguePricingRepository, QuoteFinancialService, QuoteSnapshotRepository
from devis import estimate_quantity, llm_select_candidates, select_grounded_candidates
from toolregistry import AudioInput, ImageInput, ToolRegistry, ToolRegistryConfig, TranscriptionRequest, VisionAnalysisRequest

from .prompt_loader import load_system_prompt

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_AUDIO_BYTES = 25 * 1024 * 1024
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
    return {"provider": getattr(result, "provider", None), "model": getattr(result, "model", None), "request_id": getattr(result, "request_id", None)}


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


@router.post("/api/v1/devis/match-catalogue")
def match_catalogue(request: MatchRequest) -> dict[str, Any]:
    try:
        query, input_trace, source_analysis = _enrich_description(request)
        candidates = HybridCatalogueRetriever(connection, EmbeddingGemmaProvider()).search(request.company_id, query, limit=int(os.getenv("CATALOGUE_RETRIEVAL_LIMIT", "12")))
        grounded, assumptions = select_grounded_candidates(candidates, query)
        matches = [item for item in grounded if item["item_type"] == "prestation"]
        if grounded and not matches:
            assumptions.append("Aucune prestation exploitable n'a été trouvée dans le catalogue.")
        model_quantities = None
        model_trace = None
        use_llm = os.getenv("CATALOGUE_USE_LLM", "true").lower() in ("1", "true", "yes")
        if use_llm and matches:
            matches, model_quantities, uncovered, model_trace = llm_select_candidates(query, matches, ToolRegistry())
            assumptions.extend(f"Élément demandé non couvert par le catalogue : {item}." for item in uncovered)
        elif matches:
            assumptions.append("Sélection de devis indisponible : active CATALOGUE_USE_LLM.")
            matches = []
        _, detected_unit = estimate_quantity(query)
        quantities = model_quantities or {}
        retrieved_by_id = {item["id"]: item for item in matches}
        priced_by_id = {item["id"]: item for item in CataloguePricingRepository(connection).load_prestations(request.company_id, list(quantities))}
        priced_matches: list[dict[str, Any]] = []
        for item_id in quantities:
            if item_id not in priced_by_id:
                raise ValueError("Une prestation sélectionnée est indisponible dans le catalogue.")
            priced_item = priced_by_id[item_id]
            retrieved_item = retrieved_by_id[item_id]
            priced_item["matching_confidence"] = retrieved_item["matching_confidence"]
            priced_item["rrf_score"] = retrieved_item["rrf_score"]
            priced_matches.append(priced_item)
        result = QuoteFinancialService().calculate(priced_matches, quantities)
        result.update({"retrieval_strategy": "hybrid_lexical_pgvector_rrf", "candidate_count": len(candidates), "matched_candidate_count": len(matches), "assumptions": assumptions, "quantity_assumption": None if model_quantities is not None else "Quantité à confirmer par sélection du modèle.", "detected_unit": detected_unit, "model_trace": model_trace, "input_trace": input_trace, "source_analysis": source_analysis, "description_utilisee": query})
        if request.modalite_source == "image":
            result["alertes"].append("Les observations image exigent confirmation client.")
        result["snapshot_id"] = QuoteSnapshotRepository(connection).save(request.company_id, query, result)
        return result
    except KeyError as error:
        raise HTTPException(503, "DATABASE_URL absent.") from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except Exception as error:
        logger.exception("Catalogue matching request failed.")
        raise HTTPException(503, "Service de matching catalogue indisponible.") from error
