"""GEPA + évaluateur ExtractBench pour le benchmark Devis IA.

Exécution Kaggle :
  pip install "gepa==0.1.4" google-genai scipy requests
  export GEMINI_API_KEY=...       # modèle de tâche Gemini
  export OPENROUTER_API_KEY=...   # modèle de réflexion Nemotron via OpenRouter
  python gepa_devis_ia_extractbench.py

Le script lit uniquement les deux JSON attachés au notebook. Il n'accède pas à
PostgreSQL et ne modifie pas le catalogue source.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable, Iterable

import numpy as np
from scipy.optimize import linear_sum_assignment


DEFAULT_CATALOGUE = "/kaggle/input/datasets/doharisse/catalogue1/catalogue_postgresql_ids_reels.json"
DEFAULT_DATASET = "/kaggle/input/datasets/doharisse/dataset1/synthetic_gepa_dataset.json"
DEFAULT_OUTPUT_DIR = "/kaggle/working/gepa_devis_ia"

INITIAL_INSTRUCTIONS = """Tu transformes une description de travaux BTP en prestations de devis.
Utilise exclusivement les IDs du catalogue fourni dans le contexte.
Sélectionne une prestation uniquement si elle est explicitement demandée ou déductible sans ambiguïté.
Pour chaque quantité non présente dans la description, retourne null. Ne déduis une quantité que si le calcul est directement justifié par les dimensions données.
N'invente ni prestation, ni option, ni choix ; ne sélectionne jamais une option par défaut.
Réponds uniquement avec un JSON strictement conforme à ce schéma :
{"prestations":[{"prestation_id":1,"quantite_ouvrage":8,"options":[{"option_id":1,"choix_id":2}]}]}
La racine contient uniquement "prestations". Une prestation contient uniquement "prestation_id", "quantite_ouvrage" et "options". Une option contient uniquement "option_id" et "choix_id"."""


class ModelProviderError(RuntimeError):
    """Erreur d'infrastructure de modèle : aucun score métier ne doit être produit."""


def _is_rate_limit(error: Exception) -> bool:
    message = str(error).upper()
    return "429" in message or "RESOURCE_EXHAUSTED" in message


def _retry_delay_seconds(error: Exception, fallback: float) -> float:
    """Extrait le délai conseillé par Gemini, par exemple `retryDelay: 32s`."""
    message = str(error)
    patterns = (
        r"retry\s+in\s+([0-9]+(?:\.[0-9]+)?)s",
        r"retryDelay[^0-9]*([0-9]+(?:\.[0-9]+)?)s",
    )
    for pattern in patterns:
        if match := re.search(pattern, message, flags=re.IGNORECASE):
            return max(float(match.group(1)), fallback)
    return fallback


@dataclass
class APIRequestLimiter:
    """Cadence les requêtes et réessaie les 429 sans transformer l'erreur en F1."""

    minimum_interval_seconds: float = 6.0
    max_429_retries: int = 8
    last_request_by_model: dict[str, float] = field(default_factory=dict)

    def call(self, provider_model: str, request: Callable[[], Any]) -> Any:
        for attempt in range(self.max_429_retries + 1):
            elapsed = time.monotonic() - self.last_request_by_model.get(provider_model, float("-inf"))
            wait_before_call = self.minimum_interval_seconds - elapsed
            if wait_before_call > 0:
                print(
                    f"[LIMITE API] Attente préventive de {wait_before_call:.1f}s avant le prochain appel {provider_model}.",
                    flush=True,
                )
                time.sleep(wait_before_call)
            self.last_request_by_model[provider_model] = time.monotonic()
            try:
                return request()
            except Exception as error:
                if not _is_rate_limit(error):
                    raise ModelProviderError(f"Erreur API {provider_model} sans réponse modèle : {error}") from error
                if attempt >= self.max_429_retries:
                    raise ModelProviderError(
                        f"Erreur 429 persistante pour {provider_model} après {self.max_429_retries} tentatives : {error}"
                    ) from error
                delay = _retry_delay_seconds(error, self.minimum_interval_seconds) + 1.0
                print(
                    f"[LIMITE API] 429 reçu. Aucun F1 n'est calculé ; nouvelle tentative dans {delay:.1f}s "
                    f"({attempt + 1}/{self.max_429_retries}).",
                    flush=True,
                )
                time.sleep(delay)


def load_json(path: str | Path) -> Any:
    with Path(path).open(encoding="utf-8") as stream:
        return json.load(stream)


def f1(counts: dict[str, int]) -> float:
    denominator = 2 * counts["tp"] + counts["fp"] + counts["fn"]
    return 1.0 if denominator == 0 else (2 * counts["tp"]) / denominator


def empty_counts() -> dict[str, int]:
    return {"tp": 0, "fp": 0, "fn": 0}


def new_metric_counts() -> dict[str, dict[str, int]]:
    return {
        "prestation_id_f1": empty_counts(),
        "quantite_ouvrage_f1": empty_counts(),
        "options_choix_f1": empty_counts(),
    }


def values_equal(expected: Any, predicted: Any) -> bool:
    """`null == null` est un vrai positif ; bool n'est jamais une quantité."""
    return expected == predicted


@dataclass
class CatalogueIndex:
    prestations: dict[int, dict[str, Any]]
    options: dict[int, dict[str, Any]]
    choix: dict[int, dict[str, Any]]
    prompt_catalogue: list[dict[str, Any]]

    @classmethod
    def from_export(cls, export: dict[str, Any]) -> "CatalogueIndex":
        prestations = {item["id"]: item for item in export["prestations"]}
        options = {item["id"]: item for item in export["options"]}
        choix = {item["id"]: item for item in export["choix"]}

        by_prestation: dict[int, list[dict[str, Any]]] = {key: [] for key in prestations}
        by_option: dict[int, list[dict[str, Any]]] = {key: [] for key in options}
        for option in options.values():
            if option["prestation_id"] not in prestations:
                raise ValueError(f"Option orpheline dans le catalogue : {option['id']}")
            by_prestation[option["prestation_id"]].append(option)
        for choice in choix.values():
            if choice["option_id"] not in options:
                raise ValueError(f"Choix orphelin dans le catalogue : {choice['id']}")
            by_option[choice["option_id"]].append(choice)

        prompt_catalogue = []
        for prestation in prestations.values():
            prompt_catalogue.append(
                {
                    "id": prestation["id"],
                    "nom": prestation["nom"],
                    "description": prestation.get("description", ""),
                    "options": [
                        {
                            "id": option["id"],
                            "nom": option["nom"],
                            "description": option.get("description", ""),
                            "choix": [
                                {
                                    "id": choice["id"],
                                    "nom": choice["nom"],
                                    "description": choice.get("description", ""),
                                }
                                for choice in by_option[option["id"]]
                            ],
                        }
                        for option in by_prestation[prestation["id"]]
                    ],
                }
            )
        return cls(prestations, options, choix, prompt_catalogue)

    def reference_errors(self, prediction: dict[str, Any]) -> list[str]:
        errors: list[str] = []
        for position, prestation in enumerate(prediction.get("prestations", [])):
            prestation_id = prestation["prestation_id"]
            if prestation_id not in self.prestations:
                errors.append(f"prestations[{position}].prestation_id={prestation_id} absent du catalogue")
            for option_position, option in enumerate(prestation["options"]):
                option_id = option["option_id"]
                choice_id = option["choix_id"]
                if option_id not in self.options:
                    errors.append(f"prestations[{position}].options[{option_position}].option_id={option_id} absent du catalogue")
                    continue
                if self.options[option_id]["prestation_id"] != prestation_id:
                    errors.append(
                        f"option {option_id} n'appartient pas à la prestation {prestation_id}"
                    )
                if choice_id not in self.choix:
                    errors.append(f"choix_id={choice_id} absent du catalogue")
                elif self.choix[choice_id]["option_id"] != option_id:
                    errors.append(f"choix {choice_id} n'appartient pas à l'option {option_id}")
        return errors


def validate_output(raw_text: str) -> tuple[dict[str, Any] | None, list[str]]:
    """Valide la structure JSON sans mélanger conformité et exactitude métier."""
    try:
        value = json.loads(raw_text)
    except Exception as error:
        return None, [f"JSON invalide : {error}"]

    errors: list[str] = []
    if not isinstance(value, dict) or set(value) != {"prestations"}:
        return None, ["La racine doit être un objet avec uniquement la clé 'prestations'."]
    if not isinstance(value["prestations"], list):
        return None, ["'prestations' doit être un tableau."]

    for index, prestation in enumerate(value["prestations"]):
        prefix = f"prestations[{index}]"
        if not isinstance(prestation, dict) or set(prestation) != {
            "prestation_id", "quantite_ouvrage", "options"
        }:
            errors.append(f"{prefix} doit contenir uniquement prestation_id, quantite_ouvrage, options.")
            continue
        if type(prestation["prestation_id"]) is not int:
            errors.append(f"{prefix}.prestation_id doit être un entier.")
        quantity = prestation["quantite_ouvrage"]
        if quantity is not None and (type(quantity) not in (int, float) or not math.isfinite(quantity)):
            errors.append(f"{prefix}.quantite_ouvrage doit être un nombre fini ou null.")
        if not isinstance(prestation["options"], list):
            errors.append(f"{prefix}.options doit être un tableau.")
            continue
        for option_index, option in enumerate(prestation["options"]):
            option_prefix = f"{prefix}.options[{option_index}]"
            if not isinstance(option, dict) or set(option) != {"option_id", "choix_id"}:
                errors.append(f"{option_prefix} doit contenir uniquement option_id et choix_id.")
                continue
            if type(option["option_id"]) is not int or type(option["choix_id"]) is not int:
                errors.append(f"{option_prefix}.option_id et choix_id doivent être des entiers.")
    return (value if not errors else None), errors


def _assignment(
    expected: list[dict[str, Any]],
    predicted: list[dict[str, Any]],
    paired_cost: Callable[[dict[str, Any], dict[str, Any]], int],
    expected_missing_cost: Callable[[dict[str, Any]], int],
    predicted_extra_cost: Callable[[dict[str, Any]], int],
) -> list[tuple[int | None, int | None]]:
    """Assignment global avec colonnes/lignes factices pour les éléments absents/en trop."""
    expected_count, predicted_count = len(expected), len(predicted)
    if expected_count == predicted_count == 0:
        return []
    size = expected_count + predicted_count
    costs = np.zeros((size, size), dtype=float)
    if expected_count and predicted_count:
        costs[:expected_count, :predicted_count] = [
            [paired_cost(item, other) for other in predicted] for item in expected
        ]
    if expected_count:
        costs[:expected_count, predicted_count:] = [
            [expected_missing_cost(item)] * expected_count for item in expected
        ]
    if predicted_count:
        costs[expected_count:, :predicted_count] = [
            [predicted_extra_cost(item)] * predicted_count for item in predicted
        ]

    rows, columns = linear_sum_assignment(costs)
    return [
        (
            int(row) if row < expected_count else None,
            int(column) if column < predicted_count else None,
        )
        for row, column in zip(rows, columns)
        if row < expected_count or column < predicted_count
    ]


def _append_cell(
    counts: dict[str, dict[str, int]],
    metric: str,
    expected: Any,
    predicted: Any,
    path: str,
    missing: list[dict[str, Any]],
    incorrect: list[dict[str, Any]],
) -> None:
    if values_equal(expected, predicted):
        counts[metric]["tp"] += 1
    else:
        counts[metric]["fn"] += 1
        counts[metric]["fp"] += 1
        incorrect.append({"path": path, "expected": expected, "predicted": predicted})


def _missing_prestation(
    item: dict[str, Any],
    counts: dict[str, dict[str, int]],
    missing: list[dict[str, Any]],
    label: str,
) -> None:
    counts["prestation_id_f1"]["fn"] += 1
    counts["quantite_ouvrage_f1"]["fn"] += 1
    counts["options_choix_f1"]["fn"] += 2 * len(item["options"])
    missing.append({"path": label, "expected": item})


def _extra_prestation(
    item: dict[str, Any],
    counts: dict[str, dict[str, int]],
    extra: list[dict[str, Any]],
    label: str,
) -> None:
    counts["prestation_id_f1"]["fp"] += 1
    counts["quantite_ouvrage_f1"]["fp"] += 1
    counts["options_choix_f1"]["fp"] += 2 * len(item["options"])
    extra.append({"path": label, "predicted": item})


def _score_options(
    expected: list[dict[str, Any]],
    predicted: list[dict[str, Any]],
    counts: dict[str, dict[str, int]],
    missing: list[dict[str, Any]],
    incorrect: list[dict[str, Any]],
    extra: list[dict[str, Any]],
    prefix: str,
) -> None:
    def option_pair_cost(left: dict[str, Any], right: dict[str, Any]) -> int:
        return int(left["option_id"] != right["option_id"]) + int(left["choix_id"] != right["choix_id"])

    pairs = _assignment(expected, predicted, option_pair_cost, lambda _: 2, lambda _: 2)
    for expected_index, predicted_index in pairs:
        if expected_index is None:
            counts["options_choix_f1"]["fp"] += 2
            extra.append({"path": f"{prefix}.options[{predicted_index}]", "predicted": predicted[predicted_index]})
        elif predicted_index is None:
            counts["options_choix_f1"]["fn"] += 2
            missing.append({"path": f"{prefix}.options[{expected_index}]", "expected": expected[expected_index]})
        else:
            expected_item, predicted_item = expected[expected_index], predicted[predicted_index]
            _append_cell(
                counts, "options_choix_f1", expected_item["option_id"], predicted_item["option_id"],
                f"{prefix}.options[{expected_index}].option_id", missing, incorrect,
            )
            _append_cell(
                counts, "options_choix_f1", expected_item["choix_id"], predicted_item["choix_id"],
                f"{prefix}.options[{expected_index}].choix_id", missing, incorrect,
            )


def option_alignment_cost(expected: list[dict[str, Any]], predicted: list[dict[str, Any]]) -> int:
    """Nombre minimal de cellules option/choix discordantes, après Hongrois."""
    def pair_cost(left: dict[str, Any], right: dict[str, Any]) -> int:
        return int(left["option_id"] != right["option_id"]) + int(left["choix_id"] != right["choix_id"])

    total = 0
    for expected_index, predicted_index in _assignment(expected, predicted, pair_cost, lambda _: 2, lambda _: 2):
        if expected_index is None or predicted_index is None:
            total += 2
        else:
            total += pair_cost(expected[expected_index], predicted[predicted_index])
    return total


def score_prediction(
    expected: dict[str, Any],
    predicted: dict[str, Any] | None,
    json_errors: list[str],
    catalogue: CatalogueIndex,
) -> dict[str, Any]:
    """Évalue une prédiction par alignement hongrois sur les prestations et options."""
    counts = new_metric_counts()
    missing: list[dict[str, Any]] = []
    incorrect: list[dict[str, Any]] = []
    extra: list[dict[str, Any]] = []
    expected_items = expected["prestations"]
    predicted_items = [] if predicted is None else predicted["prestations"]

    def prestation_pair_cost(left: dict[str, Any], right: dict[str, Any]) -> int:
        return (
            int(left["prestation_id"] != right["prestation_id"])
            + int(left["quantite_ouvrage"] != right["quantite_ouvrage"])
            + option_alignment_cost(left["options"], right["options"])
        )

    pairs = _assignment(
        expected_items,
        predicted_items,
        prestation_pair_cost,
        lambda item: 2 + 2 * len(item["options"]),
        lambda item: 2 + 2 * len(item["options"]),
    )
    for expected_index, predicted_index in pairs:
        if expected_index is None:
            _extra_prestation(predicted_items[predicted_index], counts, extra, f"prestations[{predicted_index}]")
            continue
        if predicted_index is None:
            _missing_prestation(expected_items[expected_index], counts, missing, f"prestations[{expected_index}]")
            continue

        expected_item, predicted_item = expected_items[expected_index], predicted_items[predicted_index]
        prefix = f"prestations[{expected_index}]"
        _append_cell(
            counts, "prestation_id_f1", expected_item["prestation_id"], predicted_item["prestation_id"],
            f"{prefix}.prestation_id", missing, incorrect,
        )
        _append_cell(
            counts, "quantite_ouvrage_f1", expected_item["quantite_ouvrage"], predicted_item["quantite_ouvrage"],
            f"{prefix}.quantite_ouvrage", missing, incorrect,
        )
        _score_options(
            expected_item["options"], predicted_item["options"], counts, missing, incorrect, extra, prefix
        )

    metrics = {name: {**value, "f1": f1(value)} for name, value in counts.items()}
    catalogue_errors = [] if predicted is None else catalogue.reference_errors(predicted)
    return {
        "json_conformity": 1.0 if predicted is not None else 0.0,
        "catalogue_references_valid": not catalogue_errors,
        "json_errors": json_errors,
        "catalogue_errors": catalogue_errors,
        "metrics": metrics,
        "missing": missing,
        "incorrect": incorrect,
        "extra": extra,
    }


def make_gemini_callable(
    api_key: str, task_model: str, minimum_interval_seconds: float
) -> tuple[Callable[[str, str], str], Callable[[str], int]]:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    limiter = APIRequestLimiter(minimum_interval_seconds=minimum_interval_seconds)

    def run_task(instructions: str, description: str) -> str:
        response = limiter.call(
            f"gemini:{task_model}",
            lambda: client.models.generate_content(
                model=task_model,
                contents=description,
                config=types.GenerateContentConfig(
                    system_instruction=instructions,
                    response_mime_type="application/json",
                    temperature=0,
                ),
            ),
        )
        return response.text or ""

    @lru_cache(maxsize=4096)
    def count_instruction_tokens(instructions: str) -> int:
        response = client.models.count_tokens(model=task_model, contents=instructions)
        return int(response.total_tokens)

    return run_task, count_instruction_tokens


def make_openrouter_reflection_callable(
    api_key: str, reflection_model: str, minimum_interval_seconds: float
) -> Callable[[str | list[dict[str, Any]]], str]:
    """OpenRouter est compatible Chat Completions ; Nemotron est configurable."""
    import requests

    limiter = APIRequestLimiter(minimum_interval_seconds=minimum_interval_seconds)

    def reflection_lm(prompt: str | list[dict[str, Any]]) -> str:
        if isinstance(prompt, list):
            prompt = "\n\n".join(str(message.get("content", "")) for message in prompt)
        def call_openrouter() -> str:
            response = requests.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": reflection_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2,
                },
                timeout=180,
            )
            if response.status_code >= 400:
                retry_after = response.headers.get("Retry-After", "")
                raise RuntimeError(f"HTTP {response.status_code} {response.text} retryDelay: {retry_after}s")
            payload = response.json()
            return payload["choices"][0]["message"]["content"] or ""

        return limiter.call(f"openrouter:{reflection_model}", call_openrouter)


    return reflection_lm


def get_api_key(name: str) -> str:
    if key := os.environ.get(name):
        return key
    try:
        from kaggle_secrets import UserSecretsClient
        return UserSecretsClient().get_secret(name)
    except Exception as error:
        raise RuntimeError(f"Ajoutez le secret Kaggle {name} ou définissez la variable {name}.") from error


@dataclass
class DevisAdapter:
    catalogue: CatalogueIndex
    run_task: Callable[[str, str], str]
    count_instruction_tokens: Callable[[str], int]
    # GEPA 0.1.4 lit cet attribut directement avant de basculer sur son
    # proposeur d'instructions par défaut. L'attribut doit donc exister même
    # lorsque l'adaptateur ne fournit pas son propre proposeur.
    propose_new_texts: Any = field(default=None, init=False, repr=False)
    verbose: bool = True
    evaluation_number: int = field(default=0, init=False)

    def _log(self, message: str) -> None:
        if self.verbose:
            print(message, flush=True)

    @staticmethod
    def _candidate_label(candidate: dict[str, str]) -> str:
        digest = hashlib.sha256(candidate["instructions"].encode("utf-8")).hexdigest()[:8]
        return f"prompt#{digest}"

    def evaluate(self, batch: list[dict[str, Any]], candidate: dict[str, str], capture_traces: bool = False):
        from gepa.core.adapter import EvaluationBatch

        instructions = candidate["instructions"]
        # Le catalogue est variable, mais ne fait pas partie du composant textuel
        # optimisé ni du calcul de tokens de l'instruction candidate.
        system_prompt = (
            f"{instructions}\n\n"
            "Catalogue PostgreSQL disponible pour cette entreprise (IDs réels) :\n"
            f"{json.dumps(self.catalogue.prompt_catalogue, ensure_ascii=False)}"
        )
        token_score = -float(self.count_instruction_tokens(instructions))
        self.evaluation_number += 1
        split = batch[0].get("split", "inconnu") if batch else "vide"
        self._log(
            f"\n[EVALUATION {self.evaluation_number}] {self._candidate_label(candidate)} | "
            f"split={split} | cas={len(batch)} | tokens instructions={-int(token_score)}"
        )
        outputs: list[dict[str, Any]] = []
        scores: list[float] = []
        objectives: list[dict[str, float]] = []
        trajectories: list[dict[str, Any]] = []

        for position, example in enumerate(batch, start=1):
            raw_text = ""
            self._log(f"  [{position}/{len(batch)}] {example['synthetic_id']} : appel Gemini...")
            try:
                raw_text = self.run_task(system_prompt, example["description"])
            except ModelProviderError:
                self._log(
                    f"  [{position}/{len(batch)}] {example['synthetic_id']} : évaluation interrompue par Gemini. "
                    "Aucun F1 n'est calculé pour ce cas."
                )
                raise
            predicted, json_errors = validate_output(raw_text)
            report = score_prediction(example["ground_truth"], predicted, json_errors, self.catalogue)
            objective = {
                "json_conformity": report["json_conformity"],
                "prestation_id_f1": report["metrics"]["prestation_id_f1"]["f1"],
                "quantite_ouvrage_f1": report["metrics"]["quantite_ouvrage_f1"]["f1"],
                "options_choix_f1": report["metrics"]["options_choix_f1"]["f1"],
                "instruction_token_score": token_score,
            }
            side_info = {
                "description": example["description"],
                "evidence": example.get("evidence", []),
                "expected": example["ground_truth"],
                "predicted": predicted,
                "raw_model_output": raw_text,
                "missing": report["missing"],
                "incorrect": report["incorrect"],
                "extra": report["extra"],
                "json_errors": report["json_errors"],
                "catalogue_errors": report["catalogue_errors"],
                "scores": objective,
            }
            outputs.append(side_info)
            scores.append(objective["prestation_id_f1"])
            objectives.append(objective)
            trajectories.append(side_info)
            self._log(
                "  "
                f"[{position}/{len(batch)}] {example['synthetic_id']} : "
                f"JSON={'OK' if predicted is not None else 'INVALIDE'} | "
                f"refs={'OK' if report['catalogue_references_valid'] else 'INVALIDES'} | "
                f"prestations={objective['prestation_id_f1']:.3f} | "
                f"quantités={objective['quantite_ouvrage_f1']:.3f} | "
                f"options/choix={objective['options_choix_f1']:.3f} | "
                f"missing={len(report['missing'])}, incorrect={len(report['incorrect'])}, extra={len(report['extra'])}"
            )
            if report["json_errors"]:
                self._log(f"    JSON : {report['json_errors']}")
            if report["catalogue_errors"]:
                self._log(f"    IDs : {report['catalogue_errors']}")

        self._log(
            f"[EVALUATION {self.evaluation_number}] terminée | "
            f"F1 prestation moyen={sum(item['prestation_id_f1'] for item in objectives) / len(objectives):.3f}"
        )
        return EvaluationBatch(
            outputs=outputs,
            scores=scores,
            trajectories=trajectories if capture_traces else None,
            objective_scores=objectives,
            num_metric_calls=len(batch),
        )

    def make_reflective_dataset(self, candidate, eval_batch, components_to_update):
        records = []
        for trace in eval_batch.trajectories or []:
            records.append(
                {
                    "Inputs": {
                        "description": trace["description"],
                        "evidence": trace["evidence"],
                        "expected": trace["expected"],
                    },
                    "Generated Outputs": trace["predicted"] if trace["predicted"] is not None else trace["raw_model_output"],
                    "Feedback": json.dumps(
                        {
                            "missing": trace["missing"],
                            "incorrect": trace["incorrect"],
                            "extra": trace["extra"],
                            "json_errors": trace["json_errors"],
                            "catalogue_errors": trace["catalogue_errors"],
                            "scores": trace["scores"],
                        },
                        ensure_ascii=False,
                    ),
                }
            )
        self._log(
            f"[REFLEXION] {len(records)} diagnostics transmis au modèle de réflexion "
            f"pour {components_to_update}."
        )
        return {component: records for component in components_to_update}


class DevisAdmissionCriterion:
    """Règles d'admission validées pour chaque exemple du minibatch.

    - JSON et prestation_id ne régressent jamais.
    - Une baisse quantité/options est acceptée seulement si l'autre métrique
      métier progresse sur cette même description.
    - Au moins une métrique (dont les tokens) doit progresser quelque part.
    """

    @staticmethod
    def _objective_pairs(proposal) -> Iterable[tuple[dict[str, float], dict[str, float]]]:
        before = (proposal.eval_before.objective_scores if proposal.eval_before else None) or []
        after = (proposal.eval_after.objective_scores if proposal.eval_after else None) or []
        return zip(before, after)

    def should_accept(self, proposal, state) -> bool:
        pairs = list(self._objective_pairs(proposal))
        if not pairs:
            print("[ADMISSION] Rejet : aucune métrique disponible.", flush=True)
            return False
        any_improvement = False
        for before, after in pairs:
            if after["json_conformity"] < before["json_conformity"]:
                print("[ADMISSION] Rejet : conformité JSON en baisse.", flush=True)
                return False
            if after["prestation_id_f1"] < before["prestation_id_f1"]:
                print("[ADMISSION] Rejet : F1 prestation_id en baisse.", flush=True)
                return False
            quantity_down = after["quantite_ouvrage_f1"] < before["quantite_ouvrage_f1"]
            options_down = after["options_choix_f1"] < before["options_choix_f1"]
            quantity_or_options_up = (
                after["quantite_ouvrage_f1"] > before["quantite_ouvrage_f1"]
                or after["options_choix_f1"] > before["options_choix_f1"]
            )
            if (quantity_down or options_down) and not quantity_or_options_up:
                print("[ADMISSION] Rejet : régression quantité/options non compensée.", flush=True)
                return False
            any_improvement = any_improvement or any(after[key] > before[key] for key in after)
        print(
            f"[ADMISSION] {'Acceptation' if any_improvement else 'Rejet'} : "
            f"amélioration mesurable={'oui' if any_improvement else 'non'}.",
            flush=True,
        )
        return any_improvement

    def reject_reason(self, proposal, state) -> str:
        return "Règle Devis IA : conformité/prestation en baisse, ou régression non compensée sur quantité/options."


def select_final_candidate(result) -> tuple[int | None, dict[str, float] | None]:
    """Sélection finale : JSON 100 %, puis F1 prestation, puis score tokens."""
    aggregate = result.val_aggregate_subscores or []
    eligible = [
        index for index, metrics in enumerate(aggregate)
        if metrics.get("json_conformity", 0.0) == 1.0
    ]
    if not eligible:
        return None, None
    selected = max(
        eligible,
        key=lambda index: (
            aggregate[index].get("prestation_id_f1", float("-inf")),
            aggregate[index].get("instruction_token_score", float("-inf")),
        ),
    )
    return selected, aggregate[selected]


def validate_ground_truth(examples: list[dict[str, Any]], catalogue: CatalogueIndex) -> None:
    for example in examples:
        errors = catalogue.reference_errors(example["ground_truth"])
        if errors:
            raise ValueError(f"GT invalide pour {example['synthetic_id']} : {errors}")


def self_test(catalogue: CatalogueIndex, examples: list[dict[str, Any]]) -> None:
    """Tests hors LLM : ordre, alignement, null et pénalisation des prestations manquantes."""
    sample = examples[0]
    perfect = score_prediction(sample["ground_truth"], sample["ground_truth"], [], catalogue)
    assert perfect["json_conformity"] == 1.0
    assert all(metric["f1"] == 1.0 for metric in perfect["metrics"].values())
    missing = score_prediction(sample["ground_truth"], {"prestations": []}, [], catalogue)
    assert missing["metrics"]["prestation_id_f1"]["fn"] == 1
    assert missing["metrics"]["quantite_ouvrage_f1"]["fn"] == 1
    assert missing["metrics"]["options_choix_f1"]["fn"] == 2 * len(sample["ground_truth"]["prestations"][0]["options"])
    print("Self-test réussi : structure, alignement et pénalisation des cellules validés.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalogue", default=DEFAULT_CATALOGUE)
    parser.add_argument("--dataset", default=DEFAULT_DATASET)
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR)
    parser.add_argument("--max-metric-calls", type=int, default=180)
    parser.add_argument(
        "--min-request-interval-seconds", type=float, default=6.0,
        help="Cadence minimale par modèle Gemini ; 6 s respecte la limite gratuite de 15 requêtes/minute.",
    )
    parser.add_argument("--resume-run-dir", default=None, help="Dossier GEPA existant à reprendre explicitement.")
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--quiet", action="store_true", help="Masque les logs détaillés de progression.")
    # Les notebooks Jupyter/Kaggle ajoutent automatiquement `-f <kernel.json>`.
    # On ne conserve que les arguments réellement destinés à cet évaluateur.
    args, unknown = parser.parse_known_args()
    if unknown:
        print(f"Arguments Jupyter ignorés : {unknown}")

    catalogue = CatalogueIndex.from_export(load_json(args.catalogue))
    dataset = load_json(args.dataset)
    examples = dataset["examples"]
    validate_ground_truth(examples, catalogue)
    print(
        f"[INITIALISATION] Catalogue : {len(catalogue.prestations)} prestations, "
        f"{len(catalogue.options)} options, {len(catalogue.choix)} choix.",
        flush=True,
    )
    if args.self_test:
        self_test(catalogue, examples)
        return

    trainset = [item for item in examples if item["split"] == "optimization"]
    valset = [item for item in examples if item["split"] == "validation"]
    if len(trainset) != 30 or len(valset) != 30:
        raise ValueError(f"Splits attendus 30/30, reçus optimization={len(trainset)}, validation={len(valset)}")
    print(
        f"[INITIALISATION] Dataset validé : optimization={len(trainset)}, validation={len(valset)}. "
        f"Budget d'évaluations={args.max_metric_calls}. Cadence Gemini={args.min_request_interval_seconds:.1f}s/appel.",
        flush=True,
    )

    gemini_api_key = get_api_key("GEMINI_API_KEY")
    openrouter_api_key = get_api_key("OPENROUTER_API_KEY")
    task_model = os.environ.get("TASK_MODEL", "gemini-2.5-flash")
    reflection_model = os.environ.get(
        "REFLECTION_MODEL", "nvidia/nemotron-3-ultra-550b-a55b"
    )
    run_task, count_tokens = make_gemini_callable(
        gemini_api_key, task_model, args.min_request_interval_seconds
    )
    reflection_lm = make_openrouter_reflection_callable(
        openrouter_api_key, reflection_model, args.min_request_interval_seconds
    )
    adapter = DevisAdapter(catalogue, run_task, count_tokens, verbose=not args.quiet)

    import gepa
    output_root = Path(args.output_dir)
    run_dir = (
        Path(args.resume_run_dir)
        if args.resume_run_dir
        else output_root / f"run_{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    )
    run_dir.mkdir(parents=True, exist_ok=True)
    print(
        f"[GEPA] Lancement de l'optimisation. Tâche Gemini={task_model} | "
        f"Réflexion OpenRouter={reflection_model} | Dossier du run : {run_dir}",
        flush=True,
    )
    try:
        result = gepa.optimize(
            seed_candidate={"instructions": INITIAL_INSTRUCTIONS},
            trainset=trainset,
            valset=valset,
            adapter=adapter,
            reflection_lm=reflection_lm,
            candidate_selection_strategy="pareto",
            frontier_type="cartesian",
            acceptance_criterion=DevisAdmissionCriterion(),
            reflection_minibatch_size=3,
            max_metric_calls=args.max_metric_calls,
            cache_evaluation=True,
            track_best_outputs=True,
            display_progress_bar=True,
            run_dir=str(run_dir),
            seed=42,
        )
    except ModelProviderError as error:
        print(
            "[ARRET PROPRE] Gemini n'a pas pu répondre après les nouvelles tentatives. "
            "Aucun F1 n'a été calculé pour la requête échouée et aucun résultat de ce run ne doit être retenu.",
            flush=True,
        )
        raise

    (run_dir / "gepa_result.json").write_text(json.dumps(result.to_dict(), ensure_ascii=False, indent=2), encoding="utf-8")
    selected_index, selected_metrics = select_final_candidate(result)
    selection = {
        "selection_rule": "JSON 100 %, puis prestation_id_f1 maximal, puis instruction_token_score maximal.",
        "selected_candidate_index": selected_index,
        "validation_metrics": selected_metrics,
        "selection_status": "selected" if selected_index is not None else "no_candidate_with_100_percent_json_conformity",
    }
    if selected_index is not None:
        selection["instructions"] = result.candidates[selected_index]["instructions"]
    (run_dir / "selected_prompt.json").write_text(
        json.dumps(selection, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"[GEPA] Résultats enregistrés dans : {run_dir}", flush=True)
    print(json.dumps(selection, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
