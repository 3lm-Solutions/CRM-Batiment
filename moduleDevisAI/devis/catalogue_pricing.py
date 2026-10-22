from __future__ import annotations

from collections import defaultdict
from typing import Any, Callable


class CataloguePricingRepository:
    """Loads authoritative prestation tariffs, components, and margin history."""

    def __init__(self, connection_factory: Callable[[], Any]) -> None:
        self._connect = connection_factory

    def load_prestations(self, company_id: int, item_ids: list[int]) -> list[dict[str, Any]]:
        if not item_ids:
            return []
        with self._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """SELECT id, sku_catalogue, label, unite, unit_cost, unit_sale_price
                   FROM catalogue_items
                   WHERE company_id=%s AND actif AND item_type='prestation' AND id = ANY(%s)
                   ORDER BY id""",
                (company_id, item_ids),
            )
            columns = [column.name for column in cur.description]
            prestations = [dict(zip(columns, row, strict=True)) for row in cur.fetchall()]
            cur.execute(
                """SELECT relation.prestation_id, component.id, component.sku_catalogue,
                          component.label, component.item_type, component.unite,
                          component.unit_cost, relation.quantity_per_unit
                   FROM catalogue_item_components relation
                   JOIN catalogue_items component ON component.id=relation.component_id
                   WHERE relation.prestation_id = ANY(%s)
                   ORDER BY relation.prestation_id, component.id""",
                (item_ids,),
            )
            component_columns = [column.name for column in cur.description]
            components: dict[int, list[dict[str, Any]]] = defaultdict(list)
            for row in cur.fetchall():
                component = dict(zip(component_columns, row, strict=True))
                components[component.pop("prestation_id")].append(component)
            cur.execute(
                """SELECT catalogue_item_id, avg(margin_percent) AS historical_margin_percent,
                          count(*) AS historical_observation_count
                   FROM catalogue_profitability_history
                   WHERE company_id=%s AND catalogue_item_id = ANY(%s)
                   GROUP BY catalogue_item_id""",
                (company_id, item_ids),
            )
            history = {row[0]: {"historical_margin_percent": row[1], "historical_observation_count": row[2]}
                       for row in cur.fetchall()}

        for prestation in prestations:
            prestation["components"] = components[prestation["id"]]
            prestation.update(history.get(prestation["id"], {}))
        return prestations
