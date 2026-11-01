from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from devis.matching import estimate_quantity, select_grounded_candidates


class MatchingUnitTest(unittest.TestCase):
    def test_estimate_quantity(self) -> None:
        qty, unit = estimate_quantity("Pose de carrelage sur une surface de 25 m²")
        self.assertEqual(qty, 25.0)
        self.assertEqual(unit, "m2")

        qty2, unit2 = estimate_quantity("Installation de 14.5 ml de plinthes")
        self.assertEqual(qty2, 14.5)
        self.assertEqual(unit2, "ml")

        qty3, unit3 = estimate_quantity("Demande sans mesure explicite")
        self.assertIsNone(qty3)
        self.assertIsNone(unit3)

    def test_select_grounded_candidates(self) -> None:
        candidates = [
            {
                "id": 1,
                "sku_catalogue": "CAR-01",
                "label": "Pose carrelage sol",
                "item_type": "prestation",
                "lexical_score": 0.8,
                "semantic_distance": 0.2,
            },
            {
                "id": 2,
                "sku_catalogue": "PEIN-01",
                "label": "Peinture acrylique blanche",
                "item_type": "materiau",
                "lexical_score": 0.0,
                "semantic_distance": 0.3,
            },
        ]
        # Query for carrelage only
        selected, assumptions = select_grounded_candidates(candidates, "Je souhaite poser du carrelage dans mon salon")
        self.assertEqual(len(selected), 1)
        self.assertEqual(selected[0]["sku_catalogue"], "CAR-01")


if __name__ == "__main__":
    unittest.main()
