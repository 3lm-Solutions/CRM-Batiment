from __future__ import annotations

import os
from typing import Protocol


class EmbeddingProvider(Protocol):
    model: str

    def embed_query(self, text: str) -> list[float]: ...
    def embed_document(self, text: str) -> list[float]: ...


class EmbeddingGemmaProvider:
    """Local Google EmbeddingGemma provider."""

    expected_dimensions = 768

    def __init__(self) -> None:
        self.model = os.getenv("CATALOGUE_EMBEDDING_MODEL", "google/embeddinggemma-300m")
        self.device = os.getenv("CATALOGUE_EMBEDDING_DEVICE", "cpu")
        self._model_instance = None

    @property
    def _model(self):
        if self._model_instance is None:
            try:
                from sentence_transformers import SentenceTransformer
            except ImportError as error:
                raise RuntimeError("Install sentence-transformers and torch to use local EmbeddingGemma.") from error
            try:
                self._model_instance = SentenceTransformer(self.model, device=self.device)
            except Exception as error:
                raise RuntimeError(
                    "Unable to load EmbeddingGemma. Accept the Google model licence on Hugging Face "
                    "and authenticate with `huggingface-cli login` once before indexing."
                ) from error
            dimensions = self._model_instance.get_embedding_dimension()
            if dimensions != self.expected_dimensions:
                raise RuntimeError(f"Expected {self.expected_dimensions}-dimension embeddings, got {dimensions}.")
        return self._model_instance

    def embed_query(self, text: str) -> list[float]:
        return self._encode(text, "encode_query")

    def embed_document(self, text: str) -> list[float]:
        return self._encode(text, "encode_document")

    def _encode(self, text: str, operation: str) -> list[float]:
        if not text or not text.strip():
            raise ValueError("Cannot embed an empty catalogue document.")
        encoder = getattr(self._model, operation, self._model.encode)
        vector = encoder(text, normalize_embeddings=True, show_progress_bar=False)
        return vector.tolist()
