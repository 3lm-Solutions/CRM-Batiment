import argparse
import csv
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any, Iterable

MODULE_ROOT = Path(__file__).resolve().parents[1]
if str(MODULE_ROOT) not in sys.path:
    sys.path.insert(0, str(MODULE_ROOT))

from toolregistry import ImageInput, ToolRegistry, ToolRegistryConfig, VisionAnalysisRequest

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = SCRIPT_DIR / "benchmark_config.json"
ENV_FILE = MODULE_ROOT / ".env"
SUPPORTED_IMAGE_MIME_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

VISION_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "image_description",
        "scene_type",
        "room_type",
        "surface_estimate_m2",
        "reference_visible",
        "reference_description",
        "visible_materials",
        "visible_elements",
        "potential_services",
        "image_quality",
        "uncertainties",
    ],
    "properties": {
        "image_description": {"type": ["string", "null"]},
        "scene_type": {"type": ["string", "null"]},
        "room_type": {"type": ["string", "null"]},
        "surface_estimate_m2": {"type": ["number", "null"], "minimum": 0},
        "reference_visible": {"type": ["boolean", "null"]},
        "reference_description": {"type": ["string", "null"]},
        "visible_materials": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["observed_name", "confidence", "evidence"],
                "properties": {
                    "observed_name": {"type": "string"},
                    "confidence": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
                    "evidence": {"type": "string"},
                },
            },
        },
        "visible_elements": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["name", "confidence", "evidence"],
                "properties": {
                    "name": {"type": "string"},
                    "confidence": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
                    "evidence": {"type": "string"},
                },
            },
        },
        "potential_services": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["service", "confidence", "evidence"],
                "properties": {
                    "service": {"type": "string"},
                    "confidence": {"type": ["number", "null"], "minimum": 0, "maximum": 1},
                    "evidence": {"type": "string"},
                },
            },
        },
        "image_quality": {
            "type": "object",
            "additionalProperties": False,
            "required": ["blur", "lighting", "occlusion", "overall"],
            "properties": {
                "blur": {"type": "string", "enum": ["none", "low", "medium", "high"]},
                "lighting": {"type": "string", "enum": ["good", "acceptable", "poor"]},
                "occlusion": {"type": "string", "enum": ["none", "low", "medium", "high"]},
                "overall": {"type": "string", "enum": ["good", "acceptable", "poor"]},
            },
        },
        "uncertainties": {"type": "array", "items": {"type": "string"}},
    },
}

DETAIL_COLUMNS = [
    "case_id",
    "model",
    "scene_type",
    "room_type",
    "surface_estimate_m2",
    "reference_visible",
    "reference_description",
    "visible_materials",
    "visible_elements",
    "potential_services",
    "image_quality",
    "uncertainties",
    "surface_gap_pct",
    "materials_match_score",
    "cost_usd",
    "json_valid",
    "latency_seconds",
    "status",
    "error_message",
]

SUMMARY_COLUMNS = [
    "model",
    "cases_attempted",
    "cases_succeeded",
    "cases_failed",
    "json_valid_rate_pct",
    "surface_accuracy_pct",
    "materials_match_score_avg",
    "p50_latency_seconds",
    "avg_cost_usd",
]


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"Missing file: {path}")
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise ValueError(f"JSON root must be an object: {path}")
    return payload


def resolve_config_path(base_dir: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else (base_dir / path)


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


def json_dump(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def parse_json_payload(raw_content: Any) -> Any:
    if raw_content is None:
        raise ValueError("Empty response content")
    if isinstance(raw_content, (dict, list, int, float, bool)):
        return raw_content

    text = str(raw_content).strip()
    if not text:
        raise ValueError("Empty response content")

    stripped = text
    stripped = re.sub(r"^```(?:json)?\s*", "", stripped, flags=re.IGNORECASE)
    stripped = re.sub(r"\s*```$", "", stripped)
    stripped = re.sub(r"^json\s*:\s*", "", stripped, flags=re.IGNORECASE)
    stripped = stripped.strip()

    candidates: list[str] = [stripped]
    for start in ("{", "["):
        idx = stripped.find(start)
        if idx >= 0:
            candidates.append(stripped[idx:])

    last_error: ValueError | None = None
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_error = exc
            continue

    if last_error is not None:
        raise last_error
    raise ValueError("Response content is not valid JSON")


def is_number(value: Any) -> bool:
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return True
    if isinstance(value, str):
        try:
            float(value)
            return True
        except ValueError:
            return False
    return False


def validate_vision_response(value: Any) -> tuple[dict[str, Any] | None, str | None]:
    if not isinstance(value, dict):
        return None, "response root must be an object"

    required = set(VISION_RESPONSE_SCHEMA["required"])
    if set(value.keys()) != required:
        return None, f"response keys must match exactly: {sorted(required)}"

    for field in ["image_description", "scene_type", "room_type", "reference_description"]:
        candidate = value.get(field)
        if candidate is not None and not isinstance(candidate, str):
            return None, f"{field} must be a string or null"

    if value.get("surface_estimate_m2") is not None:
        surface = value["surface_estimate_m2"]
        if not isinstance(surface, (int, float)) or isinstance(surface, bool) or float(surface) < 0:
            return None, "surface_estimate_m2 must be a non-negative number or null"

    if value.get("reference_visible") is not None and not isinstance(value["reference_visible"], bool):
        return None, "reference_visible must be boolean or null"

    if not isinstance(value.get("visible_materials"), list):
        return None, "visible_materials must be an array"
    for index, item in enumerate(value["visible_materials"]):
        if not isinstance(item, dict) or set(item) != {"observed_name", "confidence", "evidence"}:
            return None, f"visible_materials[{index}] has the wrong shape"
        if not isinstance(item["observed_name"], str):
            return None, f"visible_materials[{index}].observed_name must be a string"
        if item["confidence"] is not None and (not isinstance(item["confidence"], (int, float)) or not 0 <= float(item["confidence"]) <= 1):
            return None, f"visible_materials[{index}].confidence must be in [0, 1]"
        if not isinstance(item["evidence"], str):
            return None, f"visible_materials[{index}].evidence must be a string"

    if not isinstance(value.get("visible_elements"), list):
        return None, "visible_elements must be an array"
    for index, item in enumerate(value["visible_elements"]):
        if not isinstance(item, dict) or set(item) != {"name", "confidence", "evidence"}:
            return None, f"visible_elements[{index}] has the wrong shape"
        if not isinstance(item["name"], str):
            return None, f"visible_elements[{index}].name must be a string"
        if item["confidence"] is not None and (not isinstance(item["confidence"], (int, float)) or not 0 <= float(item["confidence"]) <= 1):
            return None, f"visible_elements[{index}].confidence must be in [0, 1]"
        if not isinstance(item["evidence"], str):
            return None, f"visible_elements[{index}].evidence must be a string"

    if not isinstance(value.get("potential_services"), list):
        return None, "potential_services must be an array"
    for index, item in enumerate(value["potential_services"]):
        if not isinstance(item, dict) or set(item) != {"service", "confidence", "evidence"}:
            return None, f"potential_services[{index}] has the wrong shape"
        if not isinstance(item["service"], str):
            return None, f"potential_services[{index}].service must be a string"
        if item["confidence"] is not None and (not isinstance(item["confidence"], (int, float)) or not 0 <= float(item["confidence"]) <= 1):
            return None, f"potential_services[{index}].confidence must be in [0, 1]"
        if not isinstance(item["evidence"], str):
            return None, f"potential_services[{index}].evidence must be a string"

    quality = value.get("image_quality")
    if not isinstance(quality, dict) or set(quality) != {"blur", "lighting", "occlusion", "overall"}:
        return None, "image_quality must contain blur, lighting, occlusion, and overall"
    allowed = {
        "blur": {"none", "low", "medium", "high"},
        "lighting": {"good", "acceptable", "poor"},
        "occlusion": {"none", "low", "medium", "high"},
        "overall": {"good", "acceptable", "poor"},
    }
    for key, options in allowed.items():
        if quality.get(key) not in options:
            return None, f"image_quality.{key} must be one of {sorted(options)}"

    if not isinstance(value.get("uncertainties"), list) or not all(isinstance(item, str) for item in value["uncertainties"]):
        return None, "uncertainties must be an array of strings"

    return value, None


def normalize_material_text(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        items: list[str] = []
        for item in value:
            items.extend(normalize_material_text(item))
        return items
    if isinstance(value, dict):
        if "observed_name" in value and isinstance(value["observed_name"], str):
            return [value["observed_name"]]
        return []
    text = str(value)
    if not text:
        return []
    parts = re.split(r"[,;]", text)
    return [part.strip() for part in parts if part.strip()]


def normalize_token_set(value: str) -> set[str]:
    tokens = re.findall(r"[a-zA-Z0-9]+", value.lower())
    return {token for token in tokens if token not in {"de", "des", "du", "et", "la", "le", "les", "en", "ou", "avec", "sur", "sous", "deux", "une", "plus", "pour"}}


def compute_material_match_score(predicted_materials: Any, reference_materials: Any) -> float:
    predicted_names = normalize_material_text(predicted_materials)
    reference_names = normalize_material_text(reference_materials)
    if not reference_names:
        return 0.0
    predicted_tokens = {token for name in predicted_names for token in normalize_token_set(name)}
    if not predicted_tokens:
        return 0.0

    matched = 0
    for reference_name in reference_names:
        ref_tokens = normalize_token_set(reference_name)
        if not ref_tokens:
            continue
        if ref_tokens & predicted_tokens:
            matched += 1

    score = (matched / len(reference_names)) * 5.0
    return round(min(5.0, max(0.0, score)), 2)

def compute_surface_gap_pct(predicted_surface: Any, reference_surface: Any) -> float | None:
    if predicted_surface is None or reference_surface is None:
        return None
    try:
        predicted = float(predicted_surface)
        reference = float(reference_surface)
    except (TypeError, ValueError):
        return None
    if reference <= 0:
        return 0.0 if predicted <= 0 else 100.0
    return round(min(100.0, abs(predicted - reference) / reference * 100.0), 2)


def load_dataset(dataset_path: Path, image_dir: Path) -> list[dict[str, Any]]:
    with dataset_path.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    cases: list[dict[str, Any]] = []
    for row in rows:
        case_id = (row.get("id") or row.get("case_id") or "").strip()
        if not case_id:
            continue
        for suffix in (".jpg", ".jpeg", ".png", ".webp"):
            candidate = image_dir / f"{case_id}{suffix}"
            if candidate.exists():
                cases.append({
                    "case_id": case_id,
                    "image_filename": candidate.name,
                    "image_path": candidate,
                    "reference_room_type": row.get("room_type"),
                    "reference_surface_m2": row.get("surface_approx_m2"),
                    "reference_materials": row.get("materiaux_visibles"),
                })
                break
    return cases


def migrate_legacy_results(path: Path, fieldnames: list[str]) -> None:
    if not path.exists() or path.stat().st_size == 0:
        return

    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        current_fields = reader.fieldnames or []
        if current_fields == fieldnames:
            return

        normalized_rows: list[dict[str, str]] = []
        for row in reader:
            normalized = {key: row.get(key, "") for key in fieldnames}
            normalized_rows.append(normalized)

    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in normalized_rows:
            writer.writerow(row)


def write_csv(path: Path, rows: list[dict[str, Any]], fieldnames: Iterable[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(fieldnames)
    migrate_legacy_results(path, fieldnames)

    with path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        if path.stat().st_size == 0:
            writer.writeheader()
        for row in rows:
            writer.writerow({name: row.get(name, "") for name in fieldnames})


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    if not path.is_file() or path.stat().st_size == 0:
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def write_summary_csv(path: Path, rows: list[dict[str, Any]], fieldnames: Iterable[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(fieldnames)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({name: row.get(name, "") for name in fieldnames})


def summarize(rows: list[dict[str, Any]], model_names: list[str]) -> list[dict[str, Any]]:
    def normalize_json_valid(value: Any) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"true", "1", "yes"}
        return bool(value)

    def median(values: list[float]) -> float:
        if not values:
            return 0.0
        ordered = sorted(values)
        mid = len(ordered) // 2
        if len(ordered) % 2 == 0:
            return (ordered[mid - 1] + ordered[mid]) / 2.0
        return ordered[mid]

    result: list[dict[str, Any]] = []
    for model in model_names:
        model_rows = [row for row in rows if row.get("model") == model]
        successful = [row for row in model_rows if row.get("status") == "success"]
        valid = [row for row in successful if normalize_json_valid(row.get("json_valid")) is True]
        latencies = [float(row["latency_seconds"]) for row in model_rows if is_number(row.get("latency_seconds"))]
        surface_gaps = [
            float(row["surface_gap_pct"])
            for row in model_rows
            if is_number(row.get("surface_estimate_m2")) and is_number(row.get("surface_gap_pct"))
        ]
        materials_scores = [float(row["materials_match_score"]) for row in model_rows if is_number(row.get("materials_match_score"))]
        costs = [float(row["cost_usd"]) for row in model_rows if is_number(row.get("cost_usd"))]

        json_valid_rate_pct = (len(valid) / len(successful)) * 100.0 if successful else 0.0
        surface_accuracy_pct = (100.0 - (sum(surface_gaps) / len(surface_gaps))) if surface_gaps else 0.0
        materials_match_score_avg = (sum(materials_scores) / len(materials_scores)) if materials_scores else 0.0
        p50_latency_seconds = median(latencies)
        avg_cost_usd = (sum(costs) / len(costs)) if costs else 0.0

        result.append({
            "model": model,
            "cases_attempted": len(model_rows),
            "cases_succeeded": len(successful),
            "cases_failed": len(model_rows) - len(successful),
            "json_valid_rate_pct": round(json_valid_rate_pct, 2),
            "surface_accuracy_pct": round(max(0.0, min(100.0, surface_accuracy_pct)), 2),
            "materials_match_score_avg": round(max(0.0, min(5.0, materials_match_score_avg)), 2),
            "p50_latency_seconds": round(p50_latency_seconds, 4),
            "avg_cost_usd": round(avg_cost_usd, 6),
        })
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Benchmark Gemini vision analysis on one case at a time.")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH, help="Path to benchmark_config.json.")
    parser.add_argument("--case", help="Case ID to benchmark, e.g. IC_01.")
    parser.add_argument("--model", help="Optional: run one or more named Gemini models, comma-separated.")
    parser.add_argument("--models", help="Optional: comma-separated model list; defaults to all configured models when omitted.")
    parser.add_argument("--dry-run", action="store_true", help="Validate configuration, prompt, dataset, and schema without calling the model.")
    return parser.parse_args()


def resolve_model_names(vision_cfg: dict[str, Any], explicit_model: str | None, explicit_models: str | None) -> list[str]:
    if explicit_model:
        requested = [m.strip() for m in explicit_model.split(",") if m.strip()]
    elif explicit_models:
        requested = [m.strip() for m in explicit_models.split(",") if m.strip()]
    else:
        requested = [m.strip() for m in vision_cfg.get("models", []) if m.strip()]

    if not requested:
        raise SystemExit("No model names were provided. Set --model or configure models in benchmark_config.json.")
    return requested


def compute_cost_usd(model_name: str, prompt_text: str, max_output_tokens: int, usage_metadata: dict[str, Any] | None = None) -> float:
    pricing_path = resolve_config_path(Path(__file__).resolve().parent, "pricing.json")
    pricing = load_json(pricing_path)
    model_pricing = pricing.get("vision", {}).get("models", {}).get(model_name)
    if not isinstance(model_pricing, dict):
        return 0.0

    input_tokens = 0
    output_tokens = 0
    if isinstance(usage_metadata, dict):
        input_tokens = int(usage_metadata.get("prompt_token_count") or usage_metadata.get("input_tokens") or usage_metadata.get("input_token_count") or 0)
        output_tokens = int(usage_metadata.get("candidates_token_count") or usage_metadata.get("output_tokens") or usage_metadata.get("output_token_count") or 0)

    if input_tokens == 0 and output_tokens == 0:
        input_tokens = max(1_000, len(prompt_text.encode("utf-8")) // 4 + 2000)
        output_tokens = max(256, max_output_tokens)

    input_cost = (input_tokens / 1_000_000) * float(model_pricing.get("input_usd_per_million_tokens", 0.0))
    output_cost = (output_tokens / 1_000_000) * float(model_pricing.get("output_usd_per_million_tokens", 0.0))
    return round(input_cost + output_cost, 8)


def main() -> int:
    args = parse_args()
    config_path = args.config.resolve()
    config = load_json(config_path)
    vision_cfg = config.get("vision", config)
    dataset_path = resolve_config_path(config_path.parent, str(vision_cfg.get("dataset_path"))).resolve()
    image_dir = resolve_config_path(config_path.parent, str(vision_cfg.get("image_directory"))).resolve()
    prompt_path = resolve_config_path(config_path.parent, str(vision_cfg.get("prompt_path"))).resolve()
    output_dir = resolve_config_path(config_path.parent, str(vision_cfg.get("output_directory"))).resolve()

    if not prompt_path.is_file():
        raise FileNotFoundError(f"Prompt not found: {prompt_path}")
    prompt_text = prompt_path.read_text(encoding="utf-8").strip()
    if not prompt_text:
        raise ValueError(f"Prompt is empty: {prompt_path}")

    if args.case is None or not args.case.strip():
        raise SystemExit("A case ID is required, e.g. --case IC_01")

    model_names = resolve_model_names(vision_cfg, args.model, args.models)

    max_output_tokens = int(vision_cfg.get("max_output_tokens", 3072))

    cases = load_dataset(dataset_path, image_dir)
    case_lookup = {case["case_id"]: case for case in cases}
    if args.case not in case_lookup:
        raise SystemExit(f"Case {args.case!r} was not found in {dataset_path}.")

    if args.dry_run:
        print(f"Dry-run OK: config={config_path}")
        print(f"  dataset={dataset_path}")
        print(f"  prompt={prompt_path}")
        print(f"  image_dir={image_dir}")
        print(f"  output_dir={output_dir}")
        print(f"  case={args.case}")
        print(f"  models={', '.join(model_names)}")
        print(f"  prompt_hash={hashlib.sha256(prompt_text.encode('utf-8')).hexdigest()[:12]}")
        print("  no API request sent")
        return 0

    load_env_file(ENV_FILE)
    api_key = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
    if not api_key:
        raise SystemExit("GEMINI_API_KEY (preferred) or GOOGLE_API_KEY is not configured.")

    output_dir.mkdir(parents=True, exist_ok=True)
    detail_path = output_dir / "vision_benchmark_results.csv"
    summary_path = output_dir / "vision_benchmark_summary.csv"
    detail_rows: list[dict[str, Any]] = []
    selected_case = case_lookup[args.case]
    prompt_hash = hashlib.sha256(prompt_text.encode("utf-8")).hexdigest()[:12]

    for model_name in model_names:
        row: dict[str, Any] = {
            "case_id": selected_case["case_id"],
            "model": model_name,
            "scene_type": "",
            "room_type": "",
            "surface_estimate_m2": "",
            "reference_visible": "",
            "reference_description": "",
            "visible_materials": "[]",
            "visible_elements": "[]",
            "potential_services": "[]",
            "image_quality": "{}",
            "uncertainties": "[]",
            "surface_gap_pct": "",
            "materials_match_score": "",
            "cost_usd": "",
            "json_valid": False,
            "latency_seconds": "",
            "status": "pending",
            "error_message": "",
        }
        started = time.perf_counter()
        try:
            registry = ToolRegistry(
                ToolRegistryConfig(
                    provider="google",
                    google_api_key=api_key,
                    google_vision_model=model_name,
                    timeout_seconds=float(vision_cfg.get("timeout_seconds", 120.0)),
                    max_retries=int(vision_cfg.get("max_retries", 3)),
                    max_output_tokens=max_output_tokens,
                )
            )
            response = registry.vision.analyze_photo(
                VisionAnalysisRequest(
                    image=ImageInput(
                        media_type=SUPPORTED_IMAGE_MIME_TYPES[selected_case["image_path"].suffix.lower()],
                        data=selected_case["image_path"].read_bytes(),
                    ),
                    prompt=prompt_text,
                    max_output_tokens=max_output_tokens,
                    temperature=float(vision_cfg.get("temperature", 0.0)),
                    response_mime_type="application/json",
                    response_json_schema=VISION_RESPONSE_SCHEMA,
                )
            )
            decoded = parse_json_payload(response.content)
            valid, error = validate_vision_response(decoded)
            row["json_valid"] = valid is not None
            if error:
                row["status"] = "invalid_schema"
                row["error_message"] = error
            else:
                predicted_room_type = valid.get("room_type") or ""
                predicted_surface = valid.get("surface_estimate_m2")
                reference_surface = selected_case.get("reference_surface_m2")
                usage_metadata = response.metadata.get("usage_metadata") if isinstance(response.metadata, dict) else None
                row.update({
                    "scene_type": valid.get("scene_type") or "",
                    "room_type": predicted_room_type,
                    "surface_estimate_m2": predicted_surface,
                    "reference_visible": valid.get("reference_visible"),
                    "reference_description": valid.get("reference_description") or "",
                    "visible_materials": json_dump(valid.get("visible_materials", [])),
                    "visible_elements": json_dump(valid.get("visible_elements", [])),
                    "potential_services": json_dump(valid.get("potential_services", [])),
                    "image_quality": json_dump(valid.get("image_quality", {})),
                    "uncertainties": json_dump(valid.get("uncertainties", [])),
                    "surface_gap_pct": compute_surface_gap_pct(predicted_surface, reference_surface),
                    "materials_match_score": compute_material_match_score(
                        valid.get("visible_materials", []),
                        selected_case.get("reference_materials")
                    ),
                    "cost_usd": compute_cost_usd(model_name, prompt_text, max_output_tokens, usage_metadata),
                    "status": "success",
                })
        except Exception as exc:
            row["status"] = "error"
            row["error_message"] = str(exc)
        finally:
            row["latency_seconds"] = round(time.perf_counter() - started, 4)
            detail_rows.append(row)

    write_csv(detail_path, detail_rows, DETAIL_COLUMNS)
    all_detail_rows = read_csv_rows(detail_path)
    summary_model_names = list(dict.fromkeys(
        model_names + [row["model"] for row in all_detail_rows if row.get("model")]
    ))
    summary_rows = summarize(all_detail_rows, summary_model_names)
    write_summary_csv(summary_path, summary_rows, SUMMARY_COLUMNS)

    print(f"Saved detailed results to {detail_path}")
    print(f"Saved summary to {summary_path}")
    for row in detail_rows:
        print(f"{row['model']} | {row['status']} | json_valid={row['json_valid']} | room={row['room_type']} | surface={row['surface_estimate_m2']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
