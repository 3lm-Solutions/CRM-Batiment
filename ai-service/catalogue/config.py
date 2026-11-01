"""
Configuration de la stratégie catalogue (few-shot ou RAG), pilotée par
variable d'environnement — le point de bascule unique du système.
"""
import os
from dataclasses import dataclass, field


def _env(key: str, default: str = "") -> str:
    return os.environ.get(key, default)


@dataclass
class CatalogueConfig:
    strategie: str = field(default_factory=lambda: _env("CATALOGUE_STRATEGY", "few_shot"))
    rag_similarity_threshold: float = field(
        default_factory=lambda: float(
            _env("CATALOGUE_RAG_SIMILARITY_THRESHOLD", "0.80790842")
        )
    )
    rag_embeddings_path: str = field(
        default_factory=lambda: _env(
            "CATALOGUE_RAG_EMBEDDINGS_PATH", "data/mistral_catalogue_embeddings.npz"
        )
    )
    rag_embedding_model: str = field(
        default_factory=lambda: _env("CATALOGUE_RAG_EMBEDDING_MODEL", "mistral-embed")
    )
    cache_ttl_seconds: int = field(
        default_factory=lambda: int(_env("CATALOGUE_CACHE_TTL_SECONDS", "300"))
    )
