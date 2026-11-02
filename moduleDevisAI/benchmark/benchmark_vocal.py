import argparse
import json
import mimetypes
import os
import re
import statistics
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
from jiwer import wer

MODULE_ROOT = Path(__file__).resolve().parents[1]
if str(MODULE_ROOT) not in sys.path:
    sys.path.insert(0, str(MODULE_ROOT))

from toolregistry import AudioInput, ToolRegistry, ToolRegistryConfig, TranscriptionRequest


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = SCRIPT_DIR / "benchmark_config.json"
DEFAULT_PRICING_PATH = SCRIPT_DIR / "pricing.json"
DATASET = SCRIPT_DIR / "data" / "audio_cases.csv"
AUDIO_DIR = SCRIPT_DIR / "data" / "audio"
OUTPUT_DIR = SCRIPT_DIR / "results"
ENV_FILE = MODULE_ROOT / ".env"

MODELS = ("whisper-large-v3", "whisper-large-v3-turbo")
SUPPORTED_EXTENSIONS = {".flac", ".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".ogg", ".wav", ".webm"}
PROMPT = (
    "Transcription en français dans un contexte de chantier BTP. "
    "Préserver les termes techniques, unités, matériaux et prestations."
)

PRICES_USD_PER_HOUR = {
    "whisper-large-v3": 0.111,
    "whisper-large-v3-turbo": 0.04,
}
MINIMUM_BILLABLE_SECONDS = 10.0


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, value = line.split("=", 1)
        os.environ.setdefault(name.strip(), value.strip().strip("\"'"))


def load_json(path: Path) -> dict[str, Any]:
    if not path.is_file():
        raise FileNotFoundError(f"Configuration file not found: {path}")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"Configuration must be a JSON object: {path}")
    return value


def resolve_config_path(config_path: Path, value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else config_path.parent / path


def read_dataset(path: Path) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(f"Reference CSV not found: {path}")
    df = pd.read_csv(path, sep=None, engine="python", dtype=str, keep_default_na=False)
    if df.empty:
        raise ValueError(f"Reference CSV is empty: {path}")
    if list(df.columns) == [0]:
        raise ValueError(f"Reference CSV has no header row: {path}")
    return df


def resolve_audio(audio_dir: Path, source_value: str) -> str | None:
    source = str(source_value).strip()
    if not source:
        return None
    candidate = audio_dir / source
    if candidate.is_file():
        return str(candidate)
    if Path(source).suffix:
        return None
    matches = [str(path) for path in audio_dir.glob(f"{source}.*") if path.is_file()]
    return matches[0] if len(matches) == 1 else None


def validate_dataset(dataset_path: Path, audio_dir: Path) -> tuple[pd.DataFrame, list[str], str, str]:
    df = read_dataset(dataset_path)

    if "id" not in df.columns or "transcription" not in df.columns:
        raise ValueError("Dataset must contain 'id' and 'transcription' columns.")

    columns = ["id", "transcription"]
    if "duration_s" in df.columns:
        columns.append("duration_s")

    dataset = df[columns].copy()
    dataset.columns = ["audio_identifier", "reference_transcription"] + (["duration_s"] if "duration_s" in columns else [])
    dataset["audio_identifier"] = dataset["audio_identifier"].astype(str).str.strip()
    dataset["reference_transcription"] = dataset["reference_transcription"].fillna("").astype(str).str.strip()
    if "duration_s" in dataset.columns:
        dataset["duration_s"] = pd.to_numeric(dataset["duration_s"], errors="coerce")
    dataset["audio_path"] = dataset["audio_identifier"].map(lambda value: resolve_audio(audio_dir, value))

    selected_columns = ["audio_identifier", "reference_transcription", "audio_path"]
    if "duration_s" in dataset.columns:
        selected_columns.append("duration_s")

    valid_cases = dataset.loc[dataset["audio_path"].notna(), selected_columns].copy().reset_index(drop=True)
    valid_cases.insert(0, "row_number", range(2, len(valid_cases) + 2))
    valid_cases.insert(1, "case_id", valid_cases["audio_identifier"])
    valid_cases = valid_cases[["row_number", "case_id", "audio_path", "reference_transcription"] + (["duration_s"] if "duration_s" in valid_cases.columns else [])]

    return valid_cases, [], "id", "transcription"


def normalize_text(value: str) -> str:
    """Conservative WER normalization: lowercase, Unicode NFKC, punctuation and space cleanup.
    Accents, letters, digits, units such as m²/kW, and decimal values are retained.
    Punctuation and hyphens are separators; no spelling correction or stemming is applied.
    """
    normalized = unicodedata.normalize("NFKC", value).lower()
    normalized = re.sub(r"(?<=\d)[,.](?=\d)", "decimalmarker", normalized)
    normalized = re.sub(r"[^\w\s]", " ", normalized, flags=re.UNICODE)
    normalized = normalized.replace("decimalmarker", ".")
    return " ".join(normalized.split())


def load_btp_terms(config: dict[str, Any] | None = None, config_path: Path | None = None) -> list[str]:
    if isinstance(config, dict):
        if isinstance(config.get("btp_terms"), list):
            payload = config["btp_terms"]
            return [term for term in payload if isinstance(term, str) and term.strip()]
        btp_terms_path = config.get("btp_terms_path")
        if isinstance(btp_terms_path, str):
            resolved = resolve_config_path(config_path or SCRIPT_DIR, btp_terms_path)
            payload = json.loads(resolved.read_text(encoding="utf-8"))
            if isinstance(payload, dict):
                terms = payload.get("terms", [])
            elif isinstance(payload, list):
                terms = payload
            else:
                terms = []
            return [term for term in terms if isinstance(term, str) and term.strip()]

    terms_path = SCRIPT_DIR / "btp_terms.json"
    if not terms_path.is_file():
        return []
    payload = json.loads(terms_path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        terms = payload.get("terms", [])
    elif isinstance(payload, list):
        terms = payload
    else:
        terms = []
    return [term for term in terms if isinstance(term, str) and term.strip()]


def phrase_count(text: str, phrase: str) -> int:
    text_tokens = text.split()
    phrase_tokens = normalize_text(phrase).split()
    if not phrase_tokens:
        return 0
    return sum(text_tokens[index : index + len(phrase_tokens)] == phrase_tokens for index in range(len(text_tokens) - len(phrase_tokens) + 1))


def btp_term_metrics(reference: str, prediction: str, terms: list[str]) -> tuple[int, int, float | None]:
    normalized_reference = normalize_text(reference)
    normalized_prediction = normalize_text(prediction)
    reference_count = 0
    correct_count = 0
    for term in terms:
        occurrences = phrase_count(normalized_reference, term)
        reference_count += occurrences
        correct_count += min(occurrences, phrase_count(normalized_prediction, term))
    accuracy = correct_count / reference_count if reference_count else None
    return reference_count, correct_count, accuracy


def percentile(values: list[float], fraction: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    position = (len(ordered) - 1) * fraction
    low = int(position)
    high = min(low + 1, len(ordered) - 1)
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low)


def write_csv(path: Path, rows: list[dict[str, Any]] | pd.DataFrame) -> None:
    frame = rows if isinstance(rows, pd.DataFrame) else pd.DataFrame(rows)
    if frame.empty:
        return
    frame.to_csv(path, index=False, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the vocal benchmark against the configured audio dataset.")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH, help="Path to benchmark JSON configuration.")
    args = parser.parse_args()

    config_path = args.config.resolve()
    config = load_json(config_path)
    vocal_config = config.get("vocal", config) if isinstance(config, dict) else config
    dataset_path = resolve_config_path(config_path, str(vocal_config.get("dataset_path", config.get("dataset_path", str(DATASET.relative_to(SCRIPT_DIR)))))).resolve()
    audio_dir = resolve_config_path(config_path, str(vocal_config.get("audio_directory", config.get("audio_directory", str(AUDIO_DIR.relative_to(SCRIPT_DIR)))))).resolve()
    output_dir = resolve_config_path(config_path, str(vocal_config.get("output_directory", config.get("output_directory", "results")))).resolve()
    pricing_path = resolve_config_path(config_path, str(vocal_config.get("pricing_path", config.get("pricing_path", "pricing.json")))).resolve()
    prompt_path = resolve_config_path(config_path, str(vocal_config.get("prompt_path", config.get("prompt_path", "")))).resolve()
    if prompt_path.is_file():
        prompt = prompt_path.read_text(encoding="utf-8").strip()
        if not prompt:
            raise ValueError(f"Vocal prompt is empty: {prompt_path}")
    else:
        prompt = str(vocal_config.get("prompt", config.get("prompt", PROMPT)))
    models = tuple(vocal_config.get("models", config.get("models", MODELS)))
    minimum_billable_seconds = float(vocal_config.get("minimum_billable_seconds", config.get("minimum_billable_seconds", MINIMUM_BILLABLE_SECONDS)))

    pricing_config = load_json(pricing_path)
    pricing_section = pricing_config.get("vocal", pricing_config)
    prices: dict[str, float] = {}
    for model_name, model_config in pricing_section.get("models", pricing_config.get("models", {})).items():
        if isinstance(model_config, dict):
            if "usd_per_hour" in model_config:
                value = model_config["usd_per_hour"]
            elif "price_usd_per_hour" in model_config:
                value = model_config["price_usd_per_hour"]
            else:
                continue
        else:
            value = model_config
        prices[str(model_name)] = float(value)

    valid_cases, validation_errors, audio_column, reference_column = validate_dataset(dataset_path, audio_dir)

    print("Dataset validation")
    print(f"  CSV columns used: audio={audio_column!r}, reference={reference_column!r}")
    print(f"  Valid benchmark cases: {len(valid_cases)}")
    if validation_errors:
        print("  Invalid dataset rows:")
        for error in validation_errors:
            print(f"    - {error}")
        print("Benchmark stopped: fix the invalid dataset rows above.", file=sys.stderr)
        return 2

    print(f"  Selected benchmark cases: {len(valid_cases)}")
    if os.environ.get("BENCHMARK_DRY_RUN", "").strip().lower() in {"1", "true", "yes"}:
        print("Dry run complete: no Groq request was made.")
        return 0

    load_env_file(ENV_FILE)
    api_key = os.environ.get("GROQ_API_KEY", "").strip()
    if not api_key:
        print("GROQ_API_KEY is not configured. Set it in the environment or in moduleDevisAI/.env.", file=sys.stderr)
        return 2

    run_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    run_dir = output_dir
    if run_dir.exists():
        print(f"Refusing to overwrite existing run directory: {run_dir}", file=sys.stderr)
        return 2
    run_dir.mkdir(parents=True)

    terms = load_btp_terms(vocal_config, config_path)
    rows: list[dict[str, Any]] = []

    for model in models:
        if model not in prices:
            raise KeyError(f"No price found for model {model!r} in {pricing_path}")
        # Optional OpenAI benchmark setup :
        # registry = ToolRegistry(
        #     ToolRegistryConfig(
        #         provider="openai",
        #         openai_api_key=os.environ.get("OPENAI_API_KEY", "").strip(),
        #         openai_transcription_model="whisper-1",
        #         timeout_seconds=120.0,
        #         max_retries=0,
        #     )
        # )
        registry = ToolRegistry(
            ToolRegistryConfig(
                provider="groq",
                groq_api_key=api_key,
                groq_transcription_model=model,
                timeout_seconds=120.0,
                max_retries=0,
            )
        )
        print(f"Running {model} on {len(valid_cases)} case(s)...")

        for _, case in valid_cases.iterrows():
            audio_path = Path(case["audio_path"])
            case_id = str(case["case_id"])
            reference = str(case["reference_transcription"])
            duration = case["duration_s"]
            audio_data = audio_path.read_bytes()
            mime_type = mimetypes.guess_type(audio_path.name)[0] or "application/octet-stream"
            base_row: dict[str, Any] = {
                "case_id": case_id,
                "audio_filename": audio_path.name,
                "model": model,
                "reference_transcription": reference,
                "language": "fr",
                "status": "success",
                "transcription": "",
                "latency_seconds": None,
                "audio_duration_seconds": duration,
                "estimated_cost_usd": None,
                "wer": None,
                "btp_terms_reference_count": None,
                "btp_terms_correct_count": None,
                "btp_terms_accuracy": None,
            }
            transcription_request = TranscriptionRequest(
                        audio=AudioInput(data=audio_data, filename=audio_path.name, media_type=mime_type),
                        language=str(vocal_config.get("language", config.get("language", "fr"))),
                        prompt=prompt,
                    )
            started = time.perf_counter()
            try:
                result = registry.transcription.transcribe_audio(transcription_request)
                base_row["latency_seconds"] = time.perf_counter() - started
                transcription = result.text
                if not isinstance(transcription, str) or not transcription.strip():
                    raise ValueError("ToolRegistry response contained no transcription text")

                normalized_prediction = normalize_text(transcription)
                btp_reference_count, btp_correct_count, btp_accuracy = btp_term_metrics(reference, transcription, terms)
                base_row.update(
                    {
                        "transcription": transcription,
                        "audio_duration_seconds": duration,
                        "estimated_cost_usd": (max(duration, minimum_billable_seconds) / 3600 * prices[model]) if duration is not None else None,
                        "wer": wer(normalize_text(reference), normalized_prediction),
                        "btp_terms_reference_count": btp_reference_count,
                        "btp_terms_correct_count": btp_correct_count,
                        "btp_terms_accuracy": btp_accuracy,
                    }
                )
            except Exception as error:
                base_row["latency_seconds"] = time.perf_counter() - started
                base_row.update({"status": "error", "error_type": type(error).__name__, "error_message": str(error)})
                print(f"  {case_id}: ERROR {type(error).__name__}: {error}", file=sys.stderr)
            else:
                print(f"  {case_id}: latency={base_row['latency_seconds']:.3f}s WER={base_row['wer']:.4f}")
            rows.append(base_row)

    results_csv = run_dir / "transcription_benchmark_results.csv"
    write_csv(results_csv, pd.DataFrame(rows))

    summary_df = pd.DataFrame(rows)
    if not summary_df.empty:
        summary_df = (
            summary_df.groupby("model", as_index=False)
            .agg(
                cases_attempted=("model", "size"),
                cases_succeeded=("status", lambda values: int((values == "success").sum())),
                latency_p50_seconds=("latency_seconds", lambda values: percentile([float(v) for v in values if v is not None], 0.50)),
                latency_p95_seconds=("latency_seconds", lambda values: percentile([float(v) for v in values if v is not None], 0.95)),
                latency_mean_seconds=("latency_seconds", lambda values: statistics.mean([float(v) for v in values if v is not None]) if any(v is not None for v in values) else None),
                latency_min_seconds=("latency_seconds", lambda values: min(float(v) for v in values if v is not None) if any(v is not None for v in values) else None),
                latency_max_seconds=("latency_seconds", lambda values: max(float(v) for v in values if v is not None) if any(v is not None for v in values) else None),
                wer_mean=("wer", lambda values: statistics.mean([float(v) for v in values if v is not None]) if any(v is not None for v in values) else None),
                estimated_cost_usd_total=("estimated_cost_usd", lambda values: float(sum(float(v or 0) for v in values if v is not None))),
                btp_terms_reference_count=("btp_terms_reference_count", lambda values: int(sum(int(v or 0) for v in values if v is not None))),
                btp_terms_correct_count=("btp_terms_correct_count", lambda values: int(sum(int(v or 0) for v in values if v is not None))),
            )
        )
        summary_df["btp_terms_accuracy"] = summary_df.apply(
            lambda row: (row["btp_terms_correct_count"] / row["btp_terms_reference_count"]) if row["btp_terms_reference_count"] else None,
            axis=1,
        )
    else:
        summary_df = pd.DataFrame(columns=[
            "model", "cases_attempted", "cases_succeeded", "cases_failed", "latency_p50_seconds", "latency_p95_seconds",
            "latency_mean_seconds", "latency_min_seconds", "latency_max_seconds", "wer_mean", "wer_median",
            "estimated_cost_usd_total", "btp_terms_reference_count", "btp_terms_correct_count", "btp_terms_accuracy",
        ])

    summary_path = run_dir / "transcription_benchmark_summary.csv"
    write_csv(summary_path, summary_df)

    print(f"Results CSV: {results_csv}")
    print(f"Summary CSV: {summary_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())