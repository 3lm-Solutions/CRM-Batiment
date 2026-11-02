from __future__ import annotations

import json
from typing import Any, Callable


class QuoteSnapshotRepository:
    """Persists a price/cost snapshot so later catalogue edits cannot alter history."""

    def __init__(self, connection_factory: Callable[[], Any]) -> None:
        self._connect = connection_factory

    def save(self, company_id: int, description: str, result: dict[str, Any]) -> int:
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """INSERT INTO quotation_snapshots
                   (company_id, request_description, quotation_lines, financial_summary)
                   VALUES (%s, %s, %s::jsonb, %s::jsonb) RETURNING id""",
                (company_id, description, json.dumps(result["lines"]), json.dumps({key: value for key, value in result.items() if key != "lines"})),
            )
            snapshot_id = cur.fetchone()[0]
            conn.commit()
            return snapshot_id
