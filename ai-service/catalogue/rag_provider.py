"""
Stratégie RAG (inactive tant que CATALOGUE_STRATEGY=few_shot) :

1. Embedder la description client avec mistral-embed (1024 dims).
2. Comparer en similarité cosinus aux vecteurs du fichier npz (un vecteur
   par prestation, document = nom + description + options + choix).
3. Garder les IDs dont le score est >= le seuil du benchmark (0.80790842).
4. Relire PostgreSQL en lecture seule pour ces IDs.
5. Injecter uniquement ce sous-ensemble dans le system_prompt.

Le format JSON demandé au LLM et les validations backend restent ceux
du mode few-shot.
"""
import json
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

from .base import BaseCatalogueProvider, CataloguePrestation
from .few_shot_provider import _RESPONSE_FORMAT_INSTRUCTIONS
from .mistral_embed import EXPECTED_DIM, embed_texts
from .repository import fetch_prestations_by_ids

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_EMBEDDINGS_PATH = _PROJECT_ROOT / "data" / "mistral_catalogue_embeddings.npz"
DEFAULT_SIMILARITY_THRESHOLD = 0.80790842


class RAGCatalogueProvider(BaseCatalogueProvider):
    def __init__(
        self,
        similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
        embeddings_path: Optional[str] = None,
        embedding_model: str = "mistral-embed",
    ):
        self.similarity_threshold = similarity_threshold
        self.embeddings_path = Path(embeddings_path) if embeddings_path else _DEFAULT_EMBEDDINGS_PATH
        if not self.embeddings_path.is_absolute():
            self.embeddings_path = _PROJECT_ROOT / self.embeddings_path
        self.embedding_model = embedding_model
        self._index: Optional[Tuple[np.ndarray, np.ndarray]] = None

    def build_system_prompt(self, description: str, company_id: int) -> str:
        ids = self._retrieve_prestation_ids(description)
        candidats = fetch_prestations_by_ids(company_id, ids)
        return self._render_prompt(candidats)

    def _retrieve_prestation_ids(self, description: str) -> List[int]:
        prestation_ids, catalogue_norm = self._load_index()
        query = embed_texts([description], model=self.embedding_model)[0]
        query_norm = _l2_normalize(query)
        scores = catalogue_norm @ query_norm
        keep = np.where(scores >= self.similarity_threshold)[0]
        if keep.size == 0:
            return []
        ranked = keep[np.argsort(scores[keep])[::-1]]
        return [int(prestation_ids[i]) for i in ranked]

    def _load_index(self) -> Tuple[np.ndarray, np.ndarray]:
        if self._index is not None:
            return self._index
        if not self.embeddings_path.is_file():
            raise FileNotFoundError(
                f"Index RAG introuvable : {self.embeddings_path}"
            )
        data = np.load(self.embeddings_path)
        embeddings = np.asarray(data["embeddings"], dtype=np.float32)
        prestation_ids = np.asarray(data["prestation_ids"])
        if embeddings.ndim != 2 or embeddings.shape[1] != EXPECTED_DIM:
            raise RuntimeError(
                f"Index embeddings invalide : shape={embeddings.shape}, attendu (N, {EXPECTED_DIM})"
            )
        if len(prestation_ids) != embeddings.shape[0]:
            raise RuntimeError("Index embeddings : prestation_ids et embeddings de longueurs différentes")
        self._index = (prestation_ids, _l2_normalize_matrix(embeddings))
        return self._index

    @staticmethod
    def _render_prompt(prestations: List[CataloguePrestation]) -> str:
        catalogue_json = json.dumps(
            [
                {
                    "id": p.id,
                    "nom": p.nom,
                    "description": p.description,
                    "unite": p.unite,
                    "categorie": p.categorie_nom,
                    "options": p.options,
                }
                for p in prestations
            ],
            ensure_ascii=False,
        )
        return f"""Tu es un assistant qui génère des devis BTP structurés en JSON à partir
d'une description libre du besoin d'un client.

Voici les prestations du catalogue les plus pertinentes pour cette demande
(présélectionnées par recherche sémantique) :
{catalogue_json}

{_RESPONSE_FORMAT_INSTRUCTIONS}
Si aucune prestation ci-dessus ne correspond réellement au besoin décrit,
retourne une liste "prestations" vide plutôt que d'inventer une correspondance.
"""


def _l2_normalize(vector: np.ndarray) -> np.ndarray:
    return vector / (np.linalg.norm(vector) + 1e-10)


def _l2_normalize_matrix(matrix: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(matrix, axis=1, keepdims=True) + 1e-10
    return matrix / norms
