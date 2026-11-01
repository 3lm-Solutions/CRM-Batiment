import unittest
from api.routes import _parse_structured_vision


class VisionParserTest(unittest.TestCase):
    def test_parses_pure_json(self):
        text = '{"type_piece_ou_zone": "Cuisine", "surface_estimee_m2": 12.0, "confidence_surface": 0.85}'
        result = _parse_structured_vision(text)
        self.assertEqual(result["type_piece_ou_zone"], "Cuisine")
        self.assertEqual(result["surface_estimee_m2"], 12.0)

    def test_parses_markdown_block(self):
        text = "```json\n{\"type_piece_ou_zone\": \"Salon\", \"confidence_surface\": 0.9}\n```"
        result = _parse_structured_vision(text)
        self.assertEqual(result["type_piece_ou_zone"], "Salon")

    def test_parses_markdown_block_with_surrounding_text(self):
        text = "Voici mon analyse :\n```json\n{\"type_piece_ou_zone\": \"Salle de bain\", \"surface_estimee_m2\": 6.5}\n```\nEn espérant que cela aide."
        result = _parse_structured_vision(text)
        self.assertEqual(result["type_piece_ou_zone"], "Salle de bain")
        self.assertEqual(result["surface_estimee_m2"], 6.5)

    def test_parses_with_trailing_commas(self):
        text = '{"type_piece_ou_zone": "Chambre", "materiaux_visibles": ["parquet", "peinture",], "confidence_surface": 0.75,}'
        result = _parse_structured_vision(text)
        self.assertEqual(result["type_piece_ou_zone"], "Chambre")
        self.assertEqual(result["materiaux_visibles"], ["parquet", "peinture"])

    def test_parses_truncated_json(self):
        text = '{"type_piece_ou_zone": "Bureau", "surface_estimee_m2": 14.5, "materiaux_visibles": ["moquette"'
        result = _parse_structured_vision(text)
        self.assertEqual(result["type_piece_ou_zone"], "Bureau")
        self.assertEqual(result["surface_estimee_m2"], 14.5)


if __name__ == "__main__":
    unittest.main()
