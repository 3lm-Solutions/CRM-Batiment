from __future__ import annotations

import sys
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from devis.financial_service import QuoteFinancialService


class FinancialServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.service = QuoteFinancialService()

    def test_calculates_single_line_with_components(self) -> None:
        selections = [
            {
                "id": 10,
                "sku_catalogue": "PREST-001",
                "label": "Pose carrelage sol 60x60",
                "unite": "m2",
                "unit_sale_price": 50.0,
                "selection_confidence": 0.95,
                "components": [
                    {
                        "id": 101,
                        "sku_catalogue": "MAT-001",
                        "label": "Colle carrelage C2S",
                        "item_type": "materiau",
                        "unite": "sac",
                        "unit_cost": 15.0,
                        "quantity_per_unit": 0.2,  # 3.0 € / m2
                    },
                    {
                        "id": 102,
                        "sku_catalogue": "MO-001",
                        "label": "Carreleur qualifié",
                        "item_type": "main_d_oeuvre",
                        "unite": "heure",
                        "unit_cost": 30.0,
                        "quantity_per_unit": 0.5,  # 15.0 € / m2
                    },
                ],
            }
        ]
        quantities = {10: 20.0}  # 20 m2

        result = self.service.calculate(selections, quantities)

        # Revenue = 20 * 50 = 1000 €
        self.assertEqual(result["total_ht"], 1000.0)
        # Cost per m2 = 3.0 + 15.0 = 18.0 € -> total cost = 20 * 18 = 360 €
        self.assertEqual(result["cout_total"], 360.0)
        # Margin = 1000 - 360 = 640 € (64%) -> High margin alert
        self.assertEqual(result["marge_total_euros"], 640.0)
        self.assertEqual(result["marge_pourcent"], 64.0)

        line = result["lines"][0]
        self.assertEqual(line["quantite_estimee"], 20.0)
        self.assertEqual(line["cout_unitaire"], 18.0)
        self.assertTrue(any("Alerte marge élevée" in a for a in line["alertes"]))

    def test_triggers_low_margin_alert(self) -> None:
        selections = [
            {
                "id": 20,
                "sku_catalogue": "PREST-LOW",
                "label": "Peinture plafond",
                "unite": "m2",
                "unit_sale_price": 20.0,
                "unit_cost": 18.0,  # 10% margin -> < 15%
                "components": [],
            }
        ]
        quantities = {20: 10.0}

        result = self.service.calculate(selections, quantities)
        self.assertEqual(result["total_ht"], 200.0)
        self.assertEqual(result["cout_total"], 180.0)
        self.assertEqual(result["marge_pourcent"], 10.0)

        line = result["lines"][0]
        self.assertTrue(any("Alerte marge basse" in a for a in line["alertes"]))

    def test_rejects_negative_or_zero_quantity(self) -> None:
        selections = [
            {
                "id": 30,
                "sku_catalogue": "PREST-ERR",
                "label": "Démolition",
                "unite": "m2",
                "unit_sale_price": 40.0,
                "unit_cost": 20.0,
            }
        ]
        with self.assertRaises(ValueError):
            self.service.calculate(selections, {30: -5.0})


if __name__ == "__main__":
    unittest.main()
