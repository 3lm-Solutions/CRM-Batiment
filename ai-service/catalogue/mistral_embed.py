"""Appel lecture seule à l'API embeddings Mistral (mistral-embed, 1024 dims)."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import List

import numpy as np

MISTRAL_EMBEDDINGS_URL = "https://api.mistral.ai/v1/embeddings"
EXPECTED_DIM = 1024


def embed_texts(texts: List[str], model: str = "mistral-embed") -> np.ndarray:
    api_key = os.environ.get("MISTRAL_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError(
            "MISTRAL_API_KEY n'est pas configurée (nécessaire uniquement en CATALOGUE_STRATEGY=rag)"
        )

    payload = json.dumps({"model": model, "input": texts}).encode("utf-8")
    request = urllib.request.Request(
        MISTRAL_EMBEDDINGS_URL,
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Échec mistral-embed HTTP {exc.code}: {detail}") from exc

    items = sorted(body.get("data") or [], key=lambda item: item.get("index", 0))
    vectors = [item["embedding"] for item in items]
    matrix = np.asarray(vectors, dtype=np.float32)
    if matrix.ndim != 2 or matrix.shape[1] != EXPECTED_DIM:
        raise RuntimeError(
            f"Embedding inattendu : shape={matrix.shape}, attendu (*, {EXPECTED_DIM})"
        )
    return matrix
