from __future__ import annotations

import base64
import binascii
import json
import logging
import os
import re
from typing import Any, Literal

import psycopg
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field, model_validator

from catalog import HybridCatalogueRetriever
from catalog.embeddings import EmbeddingGemmaProvider
from devis import CataloguePricingRepository, QuoteFinancialService, QuoteSnapshotRepository
from devis import llm_select_candidates, select_grounded_candidates
from devis.pdf_export import render_quote_pdf
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
        "description_scene": {"type": "string", "nullable": True},
        "type_scene": {"type": "string", "nullable": True},
        "type_piece_ou_zone": {"type": "string", "nullable": True},
        "surface_estimee_m2": {"type": "number", "nullable": True},
        "confidence_surface": {"type": "number", "minimum": 0, "maximum": 1},
        "reference_dimensionnelle_visible": {"type": "boolean"},
        "materiaux_visibles": {"type": "array", "items": {"type": "string"}},
        "elements_visibles": {"type": "array", "items": {"type": "string"}},
        "observations_etat": {"type": "array", "items": {"type": "string"}},
        "incertitudes": {"type": "array", "items": {"type": "string"}},
    },
    "required": [
        "description_scene", "type_scene", "type_piece_ou_zone", "surface_estimee_m2",
        "confidence_surface", "reference_dimensionnelle_visible", "materiaux_visibles", "elements_visibles",
        "observations_etat", "incertitudes",
    ],
}


class ImagePayload(BaseModel):
    media_type: Literal["image/jpeg", "image/png", "image/gif", "image/webp"]
    data_base64: str | None = Field(default=None, max_length=14_000_000)
    url: str | None = Field(default=None, max_length=4_000)


class PhotoAnalyzeRequest(BaseModel):
    image: ImagePayload
    provider: Literal["openai", "anthropic", "google"] | None = None
    model: str | None = Field(default=None, max_length=100)

    @model_validator(mode="before")
    @classmethod
    def clean_provider_model(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if not data.get("provider"):
                data["provider"] = None
            if not data.get("model"):
                data["model"] = None
        return data


class PhotoAnalysis(BaseModel):
    type_piece: str = Field(default="Zone non identifiee", max_length=300)
    surface_m2: float | None = Field(default=None, ge=0)
    confidence_surface: float = Field(default=0.0, ge=0, le=1)
    materiaux: list[str] = Field(default_factory=list)
    reference_visible: bool = False
    description: str = Field(default="", max_length=2000)
    observations: list[str] = Field(default_factory=list)
    incertitudes: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def handle_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "type_pièce" in data and "type_piece" not in data:
                data["type_piece"] = data["type_pièce"]
            if "matériaux" in data and "materiaux" not in data:
                data["materiaux"] = data["matériaux"]
            if "reference_dimensionnelle_visible" in data and "reference_visible" not in data:
                data["reference_visible"] = data["reference_dimensionnelle_visible"]
        return data


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
    image_analysis: PhotoAnalysis | None = None


class QuotePdfLine(BaseModel):
    label: str = Field(min_length=1, max_length=500)
    quantity: float = Field(gt=0)
    unit: str = Field(min_length=1, max_length=30)
    unit_price: float = Field(ge=0)
    total_ht: float = Field(ge=0)
    components: list[dict[str, Any]] = Field(default_factory=list)


class QuotePdfRequest(BaseModel):
    company_id: int = Field(gt=0)
    request_description: str = Field(min_length=1, max_length=4000)
    reference: str = Field(min_length=1, max_length=100)
    date: str = Field(min_length=1, max_length=30)
    vat_rate: float = Field(ge=0, le=100)
    company: dict[str, str]
    customer: dict[str, str]
    lines: list[QuotePdfLine] = Field(min_length=1)
    total_ht: float = Field(ge=0)
    total_vat: float = Field(ge=0)
    total_ttc: float = Field(ge=0)
    notes: str = Field(default="", max_length=4000)


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


def _vision_registry(provider: str | None, model: str | None) -> ToolRegistry:
    if not provider and not model:
        return _capability_registry("VISION_TOOLREGISTRY_PROVIDER")
    selected_provider = (provider or "").strip().lower()
    selected_model = (model or "").strip()
    if selected_provider not in TEXT_MODELS:
        raise ValueError("The selected provider is not supported by this vision provider.")
    if not selected_model:
        selected_model = next(iter(TEXT_MODELS[selected_provider]))
    elif selected_model not in TEXT_MODELS[selected_provider]:
        raise ValueError("The selected model is not supported by this vision provider.")
    values = dict(os.environ)
    values["TOOLREGISTRY_PROVIDER"] = selected_provider
    values[{"openai": "OPENAI_VISION_MODEL", "anthropic": "ANTHROPIC_VISION_MODEL", "google": "GOOGLE_VISION_MODEL"}[selected_provider]] = selected_model
    return ToolRegistry(ToolRegistryConfig.from_env(values))

def _parse_structured_vision(content: str) -> dict[str, Any]:
    value = content.strip()
    if not value:
        raise ValueError("The vision model returned an empty response.")

    # 1. Look for markdown code fence ```json ... ``` or ``` ... ```
    fence_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", value, re.IGNORECASE)
    if fence_match:
        candidate = fence_match.group(1).strip()
    else:
        # 2. Extract outermost matching curly braces { ... }
        start = value.find("{")
        end = value.rfind("}")
        if start >= 0 and end > start:
            candidate = value[start : end + 1].strip()
        elif start >= 0:
            candidate = value[start:].strip()
        else:
            candidate = value

    # 3. Direct JSON parsing
    try:
        payload = json.loads(candidate)
        if isinstance(payload, dict):
            return payload
    except Exception:
        pass

    # 4. Clean trailing commas (common in LLM output, e.g. {"a": 1,})
    cleaned = re.sub(r",\s*([\]}])", r"\1", candidate)
    try:
        payload = json.loads(cleaned)
        if isinstance(payload, dict):
            return payload
    except Exception:
        pass

    # 5. Handle truncated JSON by repairing unclosed braces / brackets / quotes
    repaired = cleaned.rstrip(", \n\r\t")
    if repaired.count('"') % 2 != 0:
        repaired += '"'
    open_sq = repaired.count("[") - repaired.count("]")
    if open_sq > 0:
        repaired += "]" * open_sq
    open_cur = repaired.count("{") - repaired.count("}")
    if open_cur > 0:
        repaired += "}" * open_cur
    try:
        payload = json.loads(repaired)
        if isinstance(payload, dict):
            return payload
    except Exception:
        pass

    # 6. Fallback: raw_decode from first {
    start_pos = value.find("{")
    if start_pos >= 0:
        try:
            payload, _ = json.JSONDecoder().raw_decode(value[start_pos:])
            if isinstance(payload, dict):
                return payload
        except Exception:
            pass

    # 7. Ultimate fallback: regex field extraction from response text so API never 422s unnecessarily
    extracted: dict[str, Any] = {}
    m_piece = re.search(
        r'["\'](?:type_piece_ou_zone|type_piece|type_pièce)["\']\s*:\s*["\']([^"\']+)["\']',
        value,
        re.IGNORECASE,
    )
    if m_piece:
        extracted["type_piece_ou_zone"] = m_piece.group(1).strip()
    m_surf = re.search(
        r'["\'](?:surface_estimee_m2|surface_m2)["\']\s*:\s*([0-9]+(?:[.,][0-9]+)?)',
        value,
        re.IGNORECASE,
    )
    if m_surf:
        extracted["surface_estimee_m2"] = float(m_surf.group(1).replace(",", "."))
    m_conf = re.search(
        r'["\']confidence_surface["\']\s*:\s*([0-9]+(?:[.,][0-9]+)?)',
        value,
        re.IGNORECASE,
    )
    if m_conf:
        conf_val = float(m_conf.group(1).replace(",", "."))
        extracted["confidence_surface"] = conf_val if conf_val <= 1.0 else conf_val / 100.0
    m_ref = re.search(
        r'["\'](?:reference_dimensionnelle_visible|reference_visible)["\']\s*:\s*(true|false|oui|non)',
        value,
        re.IGNORECASE,
    )
    if m_ref:
        extracted["reference_dimensionnelle_visible"] = m_ref.group(1).lower() in ("true", "oui")
    m_desc = re.search(
        r'["\'](?:description_scene|description)["\']\s*:\s*["\']([^"\']+)["\']',
        value,
        re.IGNORECASE,
    )
    if m_desc:
        extracted["description_scene"] = m_desc.group(1).strip()

    m_mat = re.search(
        r'["\'](?:materiaux_visibles|materiaux|matériaux)["\']\s*:\s*\[(.*?)\]',
        value,
        re.DOTALL | re.IGNORECASE,
    )
    if m_mat:
        items = [i.strip(' "\'\n\r\t') for i in m_mat.group(1).split(",") if i.strip(' "\'\n\r\t')]
        extracted["materiaux_visibles"] = items

    if extracted:
        logger.info("Successfully recovered vision data via fallback regex extractor.")
        return extracted

    logger.error("Failed to parse vision model response. Content preview: %s", value[:300])
    raise ValueError("The vision model returned invalid structured JSON.")


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
    if request.image_analysis is not None:
        analysis = request.image_analysis.model_dump()
        combined = "\n\n".join(part for part in (description, "Analyse visuelle validee : " + json.dumps(analysis, ensure_ascii=False)) if part)
        return combined, {"source": "image", "analysis_confirmed_by_user": True}, analysis
    image = request.image
    if (image.data_base64 is None) == (image.url is None):
        raise ValueError("image requires exactly one of data_base64 or url.")
    image_input = ImageInput(media_type=image.media_type, data=_decode_base64(image.data_base64, MAX_IMAGE_BYTES, "image.data_base64") if image.data_base64 is not None else None, url=image.url)
    vision = _vision_registry(request.provider, request.model).vision.analyze_photo(
        VisionAnalysisRequest(image=image_input, prompt="Analyse cette image conformément aux instructions système.", system_prompt=load_system_prompt("vision_analysis_system_prompt.txt"), response_mime_type="application/json", response_json_schema=VISION_SCHEMA)
    )
    analysis = _parse_structured_vision(vision.content)
    combined = "\n\n".join(part for part in (description, "Analyse visuelle structurée : " + json.dumps(analysis, ensure_ascii=False)) if part)
    return combined, {"source": "image", "vision": _model_trace(vision)}, analysis


def _photo_analysis_from_vision(content: str) -> PhotoAnalysis:
    analysis = _parse_structured_vision(content)
    return PhotoAnalysis(
        type_piece=analysis.get("type_piece_ou_zone") or "Zone non identifiee",
        surface_m2=analysis.get("surface_estimee_m2"),
        confidence_surface=analysis.get("confidence_surface", 0),
        materiaux=analysis.get("materiaux_visibles", []),
        reference_visible=analysis.get("reference_dimensionnelle_visible", False),
        description=analysis.get("description_scene") or "",
        observations=analysis.get("observations_etat", []),
        incertitudes=analysis.get("incertitudes", []),
    )


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

@router.post("/api/v1/devis/photo-analyze")
def analyze_photo(request: PhotoAnalyzeRequest) -> dict[str, Any]:
    """Analyze one JPEG/PNG chantier photo without generating a quotation."""
    try:
        image = request.image
        if image.media_type not in {"image/jpeg", "image/png"}:
            raise ValueError("Only image/jpeg and image/png are accepted.")
        if (image.data_base64 is None) == (image.url is None):
            raise ValueError("image requires exactly one of data_base64 or url.")
        image_input = ImageInput(
            media_type=image.media_type,
            data=_decode_base64(image.data_base64, MAX_IMAGE_BYTES, "image.data_base64") if image.data_base64 else None,
            url=image.url,
        )
        vision = _vision_registry(request.provider, request.model).vision.analyze_photo(
            VisionAnalysisRequest(
                image=image_input,
                prompt="Analyse cette photo de chantier et retourne uniquement le JSON structure demande.",
                system_prompt=load_system_prompt("vision_analysis_system_prompt.txt"),
                response_mime_type="application/json",
                response_json_schema=VISION_SCHEMA,
                max_output_tokens=4096,
            )
        )
        analysis = _photo_analysis_from_vision(vision.content)
        result_dict = analysis.model_dump()
        result_dict["type_pièce"] = result_dict["type_piece"]
        result_dict["matériaux"] = result_dict["materiaux"]
        return {**result_dict, "model_trace": _model_trace(vision)}
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
    except Exception as error:
        logger.exception("Photo analysis request failed.")
        raise HTTPException(503, "Service d analyse photo indisponible.") from error


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


@router.post("/api/v1/devis/pdf")
def download_quote_pdf(request: QuotePdfRequest) -> Response:
    try:
        document = request.model_dump()
        document["lines"] = [line.model_dump() for line in request.lines]
        final_result = {
            "lines": document["lines"],
            "total_ht": document["total_ht"],
            "total_vat": document["total_vat"],
            "total_ttc": document["total_ttc"],
            "reference": document["reference"],
            "document": {
                key: document[key]
                for key in ("date", "vat_rate", "company", "customer", "notes")
            },
            "status": "FINALISE",
        }
        content = render_quote_pdf(document)
        snapshot_id = QuoteSnapshotRepository(connection).save(
            request.company_id, request.request_description, final_result
        )
        safe_reference = "".join(
            character if character.isalnum() or character in "-_" else "-"
            for character in request.reference
        )
        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="devis-{safe_reference}.pdf"',
                "X-Quotation-Snapshot-Id": str(snapshot_id),
            },
        )
    except Exception as error:
        logger.exception("PDF generation failed.")
        raise HTTPException(500, "Impossible de generer le PDF du devis.") from error


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
        return {
            "lines": result["lines"],
            "alertes": result["alertes"],
            "assumptions": assumptions,
            "request_description": query,
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
