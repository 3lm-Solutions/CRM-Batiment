from __future__ import annotations

import json
import os
import re
from typing import Any

from toolregistry import TextGenerationRequest, ToolRegistry

from api.prompt_loader import load_system_prompt


def estimate_quantity(text: str) -> tuple[float | None, str | None]:
    found = re.search(r"(\d+(?:[,.]\d+)?)\s*(m2|m²|ml|kg|litre|heure|jour|pi[eè]ce)s?\b", text, re.I)
    if not found:
        return None, None
    return float(found.group(1).replace(",", ".")), found.group(2).lower().replace("²", "2")


def select_grounded_candidates(candidates: list[dict[str, Any]], description: str) -> tuple[list[dict[str, Any]], list[str]]:
    """Filters retrieval candidates."""
    semantic_distance_threshold = _semantic_distance_threshold()
    tokens = set(re.findall(r"[a-zà-ÿ]{4,}", description.lower()))
    selected: list[dict[str, Any]] = []
    for candidate in candidates:
        label_tokens = set(re.findall(r"[a-zà-ÿ]{4,}", candidate["label"].lower()))
        lexical_hit = bool(tokens & label_tokens) or (candidate.get("lexical_score") or 0) > 0
        distance = candidate.get("semantic_distance")
        close_semantic = distance is not None and float(distance) <= semantic_distance_threshold
        if not (lexical_hit or close_semantic):
            continue
        # Material/labour require an explicit signal to avoid generic semantic false positives.
        if candidate["item_type"] != "prestation" and not lexical_hit:
            continue
        copy = dict(candidate)
        copy["matching_confidence"] = "supported" if lexical_hit and close_semantic else "review"
        selected.append(copy)
    return selected, ([] if selected else ["Aucun article du catalogue ne correspond avec une confiance suffisante."])


def _semantic_distance_threshold() -> float:
    raw_value = os.getenv("CATALOGUE_SEMANTIC_DISTANCE_THRESHOLD", "0.65")
    try:
        threshold = float(raw_value)
    except ValueError as error:
        raise ValueError("CATALOGUE_SEMANTIC_DISTANCE_THRESHOLD must be between 0 and 2.") from error
    if not 0 <= threshold <= 2:
        raise ValueError("CATALOGUE_SEMANTIC_DISTANCE_THRESHOLD must be between 0 and 2.")
    return threshold


def catalogue_prompt_context(candidates: list[dict[str, Any]]) -> list[dict[str, str]]:
    """The LLM receives selectable prestation facts only, never financial data."""
    return [
        {
            "sku_catalogue": row["sku_catalogue"],
            "type": row["item_type"],
            "label": row["label"],
            "description": row.get("description", ""),
            "unite": row["unite"],
        }
        for row in candidates
        if row["item_type"] == "prestation"
    ]


_QUOTE_SELECTION_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "lignes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "sku_catalogue": {"type": "string"},
                    "quantite": {"type": "number", "exclusiveMinimum": 0},
                },
                "required": ["sku_catalogue", "quantite"],
                "additionalProperties": False,
            },
        },
        "elements_non_couverts": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["lignes", "elements_non_couverts"],
    "additionalProperties": False,
}


def llm_select_candidates(
    description: str, candidates: list[dict[str, Any]], registry: ToolRegistry
) -> tuple[list[dict[str, Any]], dict[int, float], list[str], dict[str, Any]]:
    """Returns only model lines grounded in the retrieved candidate SKU set."""
    context = catalogue_prompt_context(candidates)
    prompt = load_system_prompt("quote_selection_system_prompt.txt").replace(
        "{{catalogue_context}}", json.dumps(context, ensure_ascii=False)
    )
    response = registry.text.generate_devis_from_text(
        TextGenerationRequest(
            text=description,
            system_prompt=prompt,
            response_mime_type="application/json",
            response_json_schema=_QUOTE_SELECTION_SCHEMA,
        )
    )
    try:
        payload = _parse_model_json(response.content)
    except (TypeError, json.JSONDecodeError) as error:
        raise ValueError("The model returned invalid structured quotation JSON.") from error
    lines = payload.get("lignes", [])
    uncovered = _validate_uncovered(payload.get("elements_non_couverts", []))
    allowed = {row["sku_catalogue"]: row for row in candidates if row["item_type"] == "prestation"}
    selected: list[dict[str, Any]] = []
    quantities: dict[int, float] = {}
    seen: set[str] = set()
    if not isinstance(lines, list):
        raise ValueError("The model quotation must contain a lignes list.")
    for line in lines:
        if not isinstance(line, dict):
            raise ValueError("Each model quotation line must be an object.")
        sku, quantity = line.get("sku_catalogue"), line.get("quantite")
        if sku not in allowed or sku in seen or not isinstance(quantity, (int, float)) or isinstance(quantity, bool) or quantity <= 0:
            raise ValueError("The model returned an unknown SKU, duplicate SKU, or invalid quantity.")
        seen.add(sku)
        item = allowed[sku]
        selected.append(item)
        quantities[item["id"]] = float(quantity)
    trace = {
        "provider": getattr(response, "provider", None),
        "model": getattr(response, "model", None),
        "request_id": getattr(response, "request_id", None),
    }
    return selected, quantities, uncovered, trace


def _strip_json_fence(content: str) -> str:
    value = content.strip()
    if value.startswith("```") and value.endswith("```"):
        parts = value.split("\n", 1)
        if len(parts) != 2:
            raise ValueError("The model returned an empty fenced JSON response.")
        body, closing = parts[1].rsplit("\n", 1)
        if not closing.strip().startswith("```"):
            raise ValueError("The model returned an invalid fenced JSON response.")
        value = body
    return value


def _parse_model_json(content: str) -> dict[str, Any]:
    """Accept a JSON object even if a provider prepends a short prose sentence."""
    value = _strip_json_fence(content)
    try:
        payload = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        if not isinstance(value, str):
            raise
        start = value.find("{")
        if start < 0:
            raise
        payload, _ = json.JSONDecoder().raw_decode(value[start:])
    if not isinstance(payload, dict):
        raise ValueError("The model quotation must be a JSON object.")
    return payload


def _validate_uncovered(value: Any) -> list[str]:
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise ValueError("The model quotation must contain an elements_non_couverts string list.")
    cleaned = [item.strip() for item in value if item.strip()]
    if len(cleaned) > 10 or any(len(item) > 240 for item in cleaned):
        raise ValueError("The model returned too many or oversized uncovered elements.")
    return list(dict.fromkeys(cleaned))
