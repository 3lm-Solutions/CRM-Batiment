"""Benchmark indépendant de modèles Gemini pour Devis IA.

Ce module ne redéfinit jamais l'évaluateur métier. Il charge explicitement le
fichier GEPA d'origine et appelle directement :
  - CatalogueIndex.from_export
  - validate_output
  - score_prediction

Exécution prévue depuis le notebook Kaggle :
    python benchmark_gemini_models.py --config /kaggle/working/benchmark_config.json

Le JSON de configuration contient les chemins Kaggle, les deux modèles et les
quotas réels RPM / TPM / RPD. Aucun quota n'est fourni par défaut : l'exécution
refuse de démarrer tant que ces valeurs ne sont pas renseignées.
"""

from __future__ import annotations

import argparse
import csv
import importlib.util
import json
import os
import statistics
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


def load_json(path: str | Path) -> Any:
    with Path(path).open(encoding="utf-8") as stream:
        return json.load(stream)


def load_evaluator(path: str | Path):
    """Importe le fichier GEPA intact, sans appeler sa fonction main()."""
    source = Path(path)
    if not source.is_file():
        raise FileNotFoundError(f"Fichier évaluateur GEPA introuvable : {source}")
    spec = importlib.util.spec_from_file_location("devis_ia_gepa_evaluator", source)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Impossible d'importer l'évaluateur : {source}")
    module = importlib.util.module_from_spec(spec)
    # Les dataclasses de l'évaluateur recherchent leur module dans sys.modules.
    # L'enregistrement permet l'import direct d'un fichier conservé intact.
    sys.modules[spec.name] = module
    try:
        spec.loader.exec_module(module)
    except Exception:
        sys.modules.pop(spec.name, None)
        raise
    required = ("CatalogueIndex", "validate_output", "score_prediction", "INITIAL_INSTRUCTIONS")
    missing = [name for name in required if not hasattr(module, name)]
    if missing:
        raise RuntimeError(f"Le fichier GEPA ne contient pas les éléments requis : {missing}")
    return module


def get_api_key(environment_name: str) -> str:
    value = os.getenv(environment_name)
    if value:
        return value
    try:
        from kaggle_secrets import UserSecretsClient

        return UserSecretsClient().get_secret(environment_name)
    except Exception as error:
        raise RuntimeError(
            f"Ajoutez le secret Kaggle {environment_name} ou définissez cette variable d'environnement."
        ) from error


def mean_or_none(values: list[float]) -> float | None:
    return statistics.fmean(values) if values else None


def ensure_positive_number(value: Any, label: str, model_name: str) -> float:
    if type(value) not in (int, float) or value <= 0:
        raise ValueError(
            f"Quota réel obligatoire pour {model_name} : renseignez une valeur strictement positive pour {label}."
        )
    return float(value)


def load_instructions(config: dict[str, Any], evaluator: Any) -> str:
    """Utilise le prompt final GEPA fourni, sinon le prompt initial du fichier GEPA."""
    direct = config.get("instructions")
    if isinstance(direct, str) and direct.strip():
        return direct.strip()

    instructions_path = config.get("instructions_path")
    if instructions_path:
        payload = load_json(instructions_path)
        if not isinstance(payload.get("instructions"), str) or not payload["instructions"].strip():
            raise ValueError("instructions_path doit pointer vers un JSON contenant la clé non vide 'instructions'.")
        return payload["instructions"].strip()

    return evaluator.INITIAL_INSTRUCTIONS


@dataclass(frozen=True)
class ModelQuota:
    rpm: float
    tpm: float
    rpd: float


def parse_quota(model_config: dict[str, Any]) -> ModelQuota:
    name = str(model_config["name"])
    return ModelQuota(
        rpm=ensure_positive_number(model_config.get("rpm"), "RPM", name),
        tpm=ensure_positive_number(model_config.get("tpm"), "TPM", name),
        rpd=ensure_positive_number(model_config.get("rpd"), "RPD", name),
    )


def model_interval_seconds(model_config: dict[str, Any], quota: ModelQuota) -> float:
    """Cadence séquentielle : respecte RPM sans introduire de quota inventé."""
    configured = model_config.get("minimum_interval_seconds", 0)
    if type(configured) not in (int, float) or configured < 0:
        raise ValueError("minimum_interval_seconds doit être un nombre positif ou nul.")
    return max(float(configured), 60.0 / quota.rpm)


def usage_prompt_tokens(response: Any) -> int | None:
    """Retourne les tokens d'entrée rapportés par Gemini, jamais une approximation locale."""
    usage = getattr(response, "usage_metadata", None)
    tokens = getattr(usage, "prompt_token_count", None) if usage is not None else None
    if type(tokens) is int and tokens >= 0:
        return tokens
    return None


class GeminiRunner:
    """Nouvelle couche d'appel, distincte de l'évaluateur GEPA réutilisé."""

    def __init__(self, api_key: str, model_id: str, timeout_seconds: float, interval_seconds: float):
        from google import genai
        from google.genai import types

        self.types = types
        self.client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=int(timeout_seconds * 1000)),
        )
        self.model_id = model_id
        self.timeout_seconds = timeout_seconds
        self.interval_seconds = interval_seconds
        self._last_start: float | None = None

    def run(self, system_prompt: str, description: str) -> dict[str, Any]:
        if self._last_start is not None:
            wait = self.interval_seconds - (time.monotonic() - self._last_start)
            if wait > 0:
                time.sleep(wait)
        started = time.perf_counter()
        self._last_start = time.monotonic()
        try:
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=description,
                config=self.types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type="application/json",
                    temperature=0,
                ),
            )
            raw_text = response.text or ""
            return {
                "api_success": True,
                "raw_model_output": raw_text,
                "input_tokens": usage_prompt_tokens(response),
                "latency_seconds": time.perf_counter() - started,
                "error": None,
            }
        except Exception as error:
            return {
                "api_success": False,
                "raw_model_output": None,
                "input_tokens": None,
                "latency_seconds": time.perf_counter() - started,
                "error": f"{type(error).__name__}: {error}",
            }


def business_score(report: dict[str, Any]) -> float:
    metrics = report["metrics"]
    return 100.0 * (
        0.8 * metrics["prestation_id_f1"]["f1"]
        + 0.1 * metrics["quantite_ouvrage_f1"]["f1"]
        + 0.1 * metrics["options_choix_f1"]["f1"]
    )


def run_model(
    model_config: dict[str, Any],
    examples: list[dict[str, Any]],
    catalogue: Any,
    evaluator: Any,
    system_prompt: str,
    runs_per_description: int,
    latency_threshold_seconds: float,
    api_timeout_seconds: float,
    api_key: str,
) -> dict[str, Any]:
    quota = parse_quota(model_config)
    runner = GeminiRunner(
        api_key=api_key,
        model_id=model_config["model_id"],
        timeout_seconds=api_timeout_seconds,
        interval_seconds=model_interval_seconds(model_config, quota),
    )
    runs: list[dict[str, Any]] = []
    per_description: list[dict[str, Any]] = []

    print(
        f"\n[MODELE] {model_config['name']} ({model_config['model_id']}) | "
        f"RPM={quota.rpm:g}, TPM={quota.tpm:g}, RPD={quota.rpd:g}",
        flush=True,
    )
    for index, example in enumerate(examples, start=1):
        description_runs: list[dict[str, Any]] = []
        print(f"  [{index}/{len(examples)}] {example['synthetic_id']}", flush=True)
        for attempt in range(1, runs_per_description + 1):
            outcome = runner.run(system_prompt, example["description"])
            record: dict[str, Any] = {
                "synthetic_id": example["synthetic_id"],
                "description": example["description"],
                "attempt": attempt,
                **outcome,
                "latency_conformity": bool(
                    outcome["api_success"] and outcome["latency_seconds"] <= latency_threshold_seconds
                ),
                "json_conformity": 0.0,
                "catalogue_references_valid": None,
                "f1_prestation_id": None,
                "f1_quantite_ouvrage": None,
                "f1_options_choix": None,
                "score_metier": None,
                "json_errors": [],
                "catalogue_errors": [],
                "missing": [],
                "incorrect": [],
                "extra": [],
            }
            # Erreur API / timeout : aucun F1, conformément à la règle du projet.
            if outcome["api_success"]:
                prediction, json_errors = evaluator.validate_output(outcome["raw_model_output"])
                report = evaluator.score_prediction(
                    example["ground_truth"], prediction, json_errors, catalogue
                )
                record.update(
                    {
                        "json_conformity": report["json_conformity"],
                        "catalogue_references_valid": report["catalogue_references_valid"],
                        "f1_prestation_id": report["metrics"]["prestation_id_f1"]["f1"],
                        "f1_quantite_ouvrage": report["metrics"]["quantite_ouvrage_f1"]["f1"],
                        "f1_options_choix": report["metrics"]["options_choix_f1"]["f1"],
                        "score_metier": business_score(report),
                        "json_errors": report["json_errors"],
                        "catalogue_errors": report["catalogue_errors"],
                        "missing": report["missing"],
                        "incorrect": report["incorrect"],
                        "extra": report["extra"],
                    }
                )
            status = "OK" if record["latency_conformity"] else "NON_CONFORME"
            if not outcome["api_success"]:
                status = "ERREUR_API"
            print(
                f"    essai {attempt}/{runs_per_description}: {status} | "
                f"{record['latency_seconds']:.2f}s | JSON={record['json_conformity']:.0f} | "
                f"métier={record['score_metier'] if record['score_metier'] is not None else 'non calculé'}",
                flush=True,
            )
            runs.append(record)
            description_runs.append(record)

        scored = [item["score_metier"] for item in description_runs if item["score_metier"] is not None]
        per_description.append(
            {
                "synthetic_id": example["synthetic_id"],
                "score_metier": mean_or_none(scored),
                "score_json": 100.0 * statistics.fmean(item["json_conformity"] for item in description_runs),
                "score_latence": 100.0 * statistics.fmean(item["latency_conformity"] for item in description_runs),
                "executions_sans_reponse_modele": sum(not item["api_success"] for item in description_runs),
                "executions_scorees_metier": len(scored),
            }
        )

    input_tokens = [item["input_tokens"] for item in runs if item["input_tokens"] is not None]
    model_business = mean_or_none(
        [item["score_metier"] for item in per_description if item["score_metier"] is not None]
    )
    return {
        "model": {"name": model_config["name"], "model_id": model_config["model_id"]},
        "quotas": {"rpm": quota.rpm, "tpm": quota.tpm, "rpd": quota.rpd},
        "minimum_interval_seconds": runner.interval_seconds,
        "score_metier": model_business,
        "score_json": 100.0 * statistics.fmean(item["json_conformity"] for item in runs),
        "score_latence": 100.0 * statistics.fmean(item["latency_conformity"] for item in runs),
        "tokens_entree_moyens": mean_or_none([float(value) for value in input_tokens]),
        "executions_total": len(runs),
        "executions_api_reussies": sum(item["api_success"] for item in runs),
        "executions_erreur_api_ou_timeout": sum(not item["api_success"] for item in runs),
        "executions_avec_tokens_entree": len(input_tokens),
        "per_description": per_description,
        "runs": runs,
    }


def capacity_per_day(summary: dict[str, Any]) -> float | None:
    tokens = summary["tokens_entree_moyens"]
    if tokens is None or tokens <= 0:
        return None
    quota = summary["quotas"]
    per_minute = min(quota["rpm"], quota["tpm"] / tokens)
    return min(quota["rpd"], 1440.0 * per_minute)


def apply_capacity_and_global_scores(summaries: list[dict[str, Any]]) -> None:
    capacities = [capacity_per_day(item) for item in summaries]
    if any(value is None for value in capacities):
        raise RuntimeError(
            "Impossible de calculer la capacité : Gemini n'a pas rapporté les tokens d'entrée pour au moins un modèle."
        )
    low, high = min(capacities), max(capacities)
    for item, capacity in zip(summaries, capacities):
        # En cas d'égalité, Min-Max est indéfini. Les modèles sont ex aequo : 100 pour chacun.
        capacity_score = 100.0 if high == low else 100.0 * (capacity - low) / (high - low)
        item["capacite_theorique_devis_par_jour"] = capacity
        item["score_capacite"] = capacity_score
        if item["score_metier"] is None:
            item["score_global"] = None
        else:
            item["score_global"] = (
                0.4 * item["score_metier"]
                + 0.2 * item["score_json"]
                + 0.2 * item["score_latence"]
                + 0.2 * item["score_capacite"]
            )


def save_results(output_dir: Path, summaries: list[dict[str, Any]], config: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    compact = []
    for item in summaries:
        compact.append({key: value for key, value in item.items() if key not in {"runs", "per_description"}})
    (output_dir / "benchmark_summary.json").write_text(
        json.dumps({"configuration": config, "models": compact}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (output_dir / "benchmark_detailed_results.json").write_text(
        json.dumps({"models": summaries}, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    fields = [
        "model_name", "model_id", "synthetic_id", "attempt", "api_success", "latency_seconds",
        "latency_conformity", "input_tokens", "json_conformity", "catalogue_references_valid",
        "f1_prestation_id", "f1_quantite_ouvrage", "f1_options_choix", "score_metier", "error",
    ]
    with (output_dir / "benchmark_runs.csv").open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for summary in summaries:
            for run in summary["runs"]:
                writer.writerow({
                    "model_name": summary["model"]["name"], "model_id": summary["model"]["model_id"],
                    **{field: run.get(field) for field in fields if field not in {"model_name", "model_id"}},
                })


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    args, unknown = parser.parse_known_args()
    if unknown:
        print(f"Arguments Jupyter ignorés : {unknown}", flush=True)
    config = load_json(args.config)
    evaluator = load_evaluator(config["evaluator_path"])
    catalogue = evaluator.CatalogueIndex.from_export(load_json(config["catalogue_path"]))
    dataset = load_json(config["test_dataset_path"])
    examples = dataset.get("examples")
    if not isinstance(examples, list) or not examples:
        raise ValueError("Le dataset de test doit contenir une liste non vide 'examples'.")
    for example in examples:
        errors = catalogue.reference_errors(example["ground_truth"])
        if errors:
            raise ValueError(f"Ground Truth invalide pour {example['synthetic_id']} : {errors}")

    runs_per_description = config.get("runs_per_description", 10)
    if type(runs_per_description) is not int or runs_per_description != 10:
        raise ValueError("Le CDC impose exactement 10 exécutions indépendantes par description.")
    latency_threshold = float(config.get("latency_threshold_seconds", 30.0))
    api_timeout = float(config.get("api_timeout_seconds", 45.0))
    if latency_threshold != 30.0:
        raise ValueError("Le CDC impose un seuil de latence de 30 secondes.")
    if api_timeout < latency_threshold:
        raise ValueError("api_timeout_seconds doit être supérieur ou égal au seuil de 30 secondes.")
    models = config.get("models")
    if not isinstance(models, list) or len(models) < 2:
        raise ValueError("Configurez au moins deux modèles Gemini à comparer.")
    if any(not isinstance(item.get("name"), str) or not isinstance(item.get("model_id"), str) for item in models):
        raise ValueError("Chaque modèle doit avoir name et model_id.")

    instructions = load_instructions(config, evaluator)
    system_prompt = (
        f"{instructions}\n\nCatalogue PostgreSQL disponible pour cette entreprise (IDs réels) :\n"
        f"{json.dumps(catalogue.prompt_catalogue, ensure_ascii=False)}"
    )
    print(
        f"[INITIALISATION] {len(examples)} descriptions, 10 exécutions/description, "
        f"seuil latence={latency_threshold:.0f}s.", flush=True
    )
    api_key = get_api_key(config.get("api_key_env", "GEMINI_API_KEY"))
    summaries = [
        run_model(
            model_config=model,
            examples=examples,
            catalogue=catalogue,
            evaluator=evaluator,
            system_prompt=system_prompt,
            runs_per_description=runs_per_description,
            latency_threshold_seconds=latency_threshold,
            api_timeout_seconds=api_timeout,
            api_key=api_key,
        )
        for model in models
    ]
    apply_capacity_and_global_scores(summaries)
    output_dir = Path(config.get("output_dir", "/kaggle/working/devis_ia_gemini_benchmark"))
    save_results(output_dir, summaries, config)
    print("\n=== RESULTATS FINAUX ===", flush=True)
    for item in summaries:
        print(json.dumps({
            "model": item["model"],
            "score_metier": item["score_metier"],
            "score_json": item["score_json"],
            "score_latence": item["score_latence"],
            "capacite_theorique_devis_par_jour": item["capacite_theorique_devis_par_jour"],
            "score_capacite": item["score_capacite"],
            "score_global": item["score_global"],
        }, ensure_ascii=False, indent=2), flush=True)
    print(f"Résultats écrits dans : {output_dir}", flush=True)


if __name__ == "__main__":
    main()
