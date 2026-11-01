from __future__ import annotations

import base64
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import api.routes as routes
from api.routes import PhotoAnalysis, PhotoAnalyzeRequest, _photo_analysis_from_vision


VISION_RESULT = {
    "description_scene": "Cuisine à rénover.", "type_scene": "interieur",
    "type_piece_ou_zone": "Cuisine", "surface_estimee_m2": 12.0,
    "confidence_surface": 0.82, "reference_dimensionnelle_visible": True,
    "materiaux_visibles": ["carrelage"], "elements_visibles": [],
    "observations_etat": ["Sol usé"], "incertitudes": [],
}


class PhotoAnalysisContractTest(unittest.TestCase):
    def test_maps_vision_schema_to_frontend_contract(self) -> None:
        original_parser = routes._parse_structured_vision
        routes._parse_structured_vision = lambda _: VISION_RESULT
        try:
            analysis = _photo_analysis_from_vision("ignored")
        finally:
            routes._parse_structured_vision = original_parser
        self.assertEqual(analysis.type_piece, "Cuisine")
        self.assertEqual(analysis.surface_m2, 12.0)
        self.assertEqual(analysis.materiaux, ["carrelage"])
        self.assertTrue(analysis.reference_visible)
        self.assertEqual(analysis.confidence_surface, 0.82)

    def test_handles_accented_aliases_in_photo_analysis(self) -> None:
        analysis = PhotoAnalysis.model_validate({
            "type_pièce": "Chambre parentale",
            "surface_m2": 15.5,
            "confidence_surface": 0.65,
            "matériaux": ["parquet", "peinture"],
            "reference_dimensionnelle_visible": False,
        })
        self.assertEqual(analysis.type_piece, "Chambre parentale")
        self.assertEqual(analysis.surface_m2, 15.5)
        self.assertEqual(analysis.materiaux, ["parquet", "peinture"])
        self.assertFalse(analysis.reference_visible)
        self.assertEqual(analysis.confidence_surface, 0.65)

    def test_rejects_non_jpeg_png_before_calling_vision(self) -> None:
        request = PhotoAnalyzeRequest(image={"media_type": "image/gif", "data_base64": base64.b64encode(b"image").decode()})
        with self.assertRaises(Exception) as context:
            routes.analyze_photo(request)
        self.assertIn("image/jpeg", str(context.exception))

    def test_rejects_missing_image_data(self) -> None:
        request = PhotoAnalyzeRequest(image={"media_type": "image/jpeg"})
        with self.assertRaises(Exception) as context:
            routes.analyze_photo(request)
        self.assertIn("exactly one of data_base64 or url", str(context.exception))

    def test_rejects_oversized_image(self) -> None:
        oversized = b"x" * (10 * 1024 * 1024 + 100)
        request = PhotoAnalyzeRequest(image={
            "media_type": "image/jpeg",
            "data_base64": base64.b64encode(oversized).decode(),
        })
        with self.assertRaises(Exception) as context:
            routes.analyze_photo(request)
        self.assertIn("exceeds the maximum accepted size", str(context.exception))


if __name__ == "__main__":
    unittest.main()
