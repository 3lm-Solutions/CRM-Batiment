from __future__ import annotations

from typing import Any, Callable

from .embeddings import EmbeddingProvider


class CatalogueIndexer:
    def __init__(self, connection_factory: Callable[[], Any], embeddings: EmbeddingProvider) -> None:
        self._connect = connection_factory
        self._embeddings = embeddings

    def index_pending(self, company_id: int, batch_size: int = 100) -> int:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """SELECT id, label, description, sku_catalogue, item_type, unite
                   FROM catalogue_items
                   WHERE company_id=%s AND actif AND embedding IS NULL
                   ORDER BY id LIMIT %s""",
                (company_id, batch_size),
            )
            rows = cur.fetchall()
            for item_id, label, description, sku, item_type, unit in rows:
                vector = self._embeddings.embed_document(
                    self.document(label, description, sku, item_type, unit)
                )
                cur.execute(
                    """UPDATE catalogue_items
                       SET embedding=%s::vector, embedding_model=%s,
                           embedding_updated_at=now(), updated_at=now()
                       WHERE id=%s""",
                    ("[" + ",".join(map(str, vector)) + "]", self._embeddings.model, item_id),
                )
            conn.commit()
            return len(rows)

    @staticmethod
    def document(label: str, description: str, sku: str, item_type: str, unit: str) -> str:
        return (
            f"Type: {item_type}. Libellé: {label}. Description: {description or ''}. "
            f"Unité: {unit}. Référence: {sku}."
        )
