from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Any


LOW_MARGIN_THRESHOLD = Decimal("15")
HIGH_MARGIN_THRESHOLD = Decimal("40")


class QuoteFinancialService:
    """Calculates quote revenue, composition costs, and margins deterministically."""

    def calculate(self, selections: list[dict[str, Any]], quantities: dict[int, float]) -> dict[str, Any]:
        lines: list[dict[str, Any]] = []
        alerts: list[str] = []
        total_revenue = Decimal("0")
        total_cost = Decimal("0")
        for item in selections:
            quantity = Decimal(str(quantities.get(item["id"], 1)))
            if quantity <= 0:
                raise ValueError(f"La quantité de {item['sku_catalogue']} doit être positive.")
            sale_price = item.get("unit_sale_price")
            if sale_price is None:
                raise ValueError(f"Tarif de vente absent: {item['label']}.")
            unit_cost, component_lines = self.component_cost(item, quantity)
            revenue = quantity * Decimal(str(sale_price))
            line_cost = quantity * unit_cost
            margin = revenue - line_cost
            margin_percent = margin / revenue * 100 if revenue else None
            total_revenue += revenue
            total_cost += line_cost
            lines.append({
                "catalogue_item_id": item["id"], "sku_catalogue": item["sku_catalogue"],
                "label_prestation": item["label"], "quantite_estimee": float(quantity),
                "unite": item["unite"], "prix_unitaire": self.money(Decimal(str(sale_price))),
                "sous_total": self.money(revenue), "cout_unitaire": self.money(unit_cost),
                "cout_total": self.money(line_cost), "marge_euros": self.money(margin),
                "marge_pourcent": self.money(margin_percent) if margin_percent is not None else None,
                "composants": component_lines,
                "marge_historique_pourcent": self.money(Decimal(str(item["historical_margin_percent"])))
                if item.get("historical_margin_percent") is not None else None,
                "observations_historiques": item.get("historical_observation_count", 0),
                "matching_confidence": item.get("matching_confidence", "unrated"),
                "matching_score": float(item["rrf_score"]) if item.get("rrf_score") is not None else None,
            })
        total_margin = total_revenue - total_cost
        margin_percent = total_margin / total_revenue * 100 if total_revenue else None
        if margin_percent is not None and margin_percent < LOW_MARGIN_THRESHOLD:
            alerts.append("Alerte marge basse (< 15 %).")
        if margin_percent is not None and margin_percent > HIGH_MARGIN_THRESHOLD:
            alerts.append("Alerte marge élevée (> 40 %), à vérifier.")
        historical_revenue = sum(
            Decimal(str(line["sous_total"])) for line in lines if line["marge_historique_pourcent"] is not None
        )
        historical_margin = (
            sum(
                Decimal(str(line["sous_total"])) * Decimal(str(line["marge_historique_pourcent"]))
                for line in lines if line["marge_historique_pourcent"] is not None
            ) / historical_revenue if historical_revenue else None
        )
        return {
            "lines": lines, "total_ht": self.money(total_revenue),
            "cout_total": self.money(total_cost), "marge_total_euros": self.money(total_margin),
            "marge_pourcent": self.money(margin_percent) if margin_percent is not None else None,
            "marge_historique_moyenne_pourcent": self.money(historical_margin) if historical_margin is not None else None,
            "alertes": alerts,
        }

    def component_cost(self, item: dict[str, Any], prestation_quantity: Decimal) -> tuple[Decimal, list[dict[str, Any]]]:
        components = item.get("components", [])
        if not components:
            fallback_cost = item.get("unit_cost")
            if fallback_cost is None:
                raise ValueError(f"Coût unitaire absent: {item['label']}.")
            return Decimal(str(fallback_cost)), []
        cost = Decimal("0")
        lines: list[dict[str, Any]] = []
        for component in components:
            component_cost = component.get("unit_cost")
            if component_cost is None:
                raise ValueError(f"Coût unitaire absent: {component['label']}.")
            quantity = Decimal(str(component["quantity_per_unit"]))
            unit_cost = Decimal(str(component_cost))
            component_total = quantity * unit_cost
            cost += component_total
            lines.append({
                "sku_catalogue": component["sku_catalogue"], "label": component["label"],
                "type": component["item_type"], "unite": component["unite"],
                "quantite_par_unite": float(quantity), "cout_unitaire": self.money(unit_cost),
                "cout_par_unite_prestation": self.money(component_total),
                "quantite_totale": float(quantity * prestation_quantity),
                "cout_total": self.money(component_total * prestation_quantity),
            })
        return cost, lines

    @staticmethod
    def money(value: Decimal) -> float:
        return float(value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
