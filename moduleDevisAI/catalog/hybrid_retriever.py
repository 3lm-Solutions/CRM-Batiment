from __future__ import annotations

import os
from typing import Any, Callable

from .embeddings import EmbeddingProvider


class HybridCatalogueRetriever:
    """Tenant-isolated reciprocal-rank fusion of French FTS and pgvector."""

    def __init__(self, connection_factory: Callable[[], Any], embeddings: EmbeddingProvider) -> None:
        self._connect = connection_factory
        self._embeddings = embeddings
        self._rrf_k = self._positive_int_setting("CATALOGUE_RRF_K", 60)
        self._candidate_multiplier = self._positive_int_setting("CATALOGUE_CANDIDATE_MULTIPLIER", 4)
        self._candidate_minimum = self._positive_int_setting("CATALOGUE_CANDIDATE_MINIMUM", 20)

    def search(self, company_id: int, query: str, limit: int = 8) -> list[dict[str, Any]]:
        query = query.strip()
        if not query or limit < 1:
            return []

        vector = self._embeddings.embed_query(query)
        vector_literal = "[" + ",".join(str(value) for value in vector) + "]"
        sql = """
            WITH query_terms AS (
                SELECT to_tsquery(
                    'french',
                    array_to_string(tsvector_to_array(to_tsvector('french', %(query)s)), ' | ')
                ) AS tsquery
            ), lexical AS (
                SELECT c.id, ts_rank_cd(c.search_document, q.tsquery) AS lexical_score,
                    row_number() OVER (ORDER BY ts_rank_cd(c.search_document, q.tsquery) DESC) AS rank
                FROM catalogue_items c CROSS JOIN query_terms q
                WHERE c.company_id=%(company_id)s AND c.actif AND c.search_document @@ q.tsquery
                LIMIT %(candidate_limit)s
            ), semantic AS (
                SELECT id, embedding <=> %(embedding)s::vector AS semantic_distance,
                    row_number() OVER (ORDER BY embedding <=> %(embedding)s::vector) AS rank
                FROM catalogue_items
                WHERE company_id=%(company_id)s AND actif AND embedding IS NOT NULL
                LIMIT %(candidate_limit)s
            ), fused AS (
                SELECT id, sum(1.0 / (%(rrf_k)s + rank)) AS rrf_score
                FROM (SELECT id, rank FROM lexical UNION ALL SELECT id, rank FROM semantic) ranks
                GROUP BY id
            )
            SELECT c.id, c.sku_catalogue, c.item_type, c.label, c.description, c.unite,
                   c.unit_cost,
                   f.rrf_score, l.lexical_score, s.semantic_distance
            FROM fused f JOIN catalogue_items c ON c.id=f.id
            LEFT JOIN lexical l ON l.id=c.id LEFT JOIN semantic s ON s.id=c.id
            ORDER BY f.rrf_score DESC, c.id ASC LIMIT %(limit)s
        """
        params = {"company_id": company_id, "query": query, "embedding": vector_literal,
                  "candidate_limit": max(limit * self._candidate_multiplier, self._candidate_minimum),
                  "rrf_k": self._rrf_k, "limit": limit}
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(sql, params)
            columns = [item.name for item in cur.description]
            return [dict(zip(columns, row, strict=True)) for row in cur.fetchall()]

    @staticmethod
    def _positive_int_setting(name: str, default: int) -> int:
        raw_value = os.getenv(name, str(default))
        try:
            value = int(raw_value)
        except ValueError as error:
            raise ValueError(f"{name} must be a positive integer.") from error
        if value < 1:
            raise ValueError(f"{name} must be a positive integer.")
        return value
