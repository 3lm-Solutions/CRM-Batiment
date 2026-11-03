"""Interface Gradio locale de mesure photo.

Cette interface reprend le calcul du notebook OpenCV : le rectangle noir sert
de repère de calibration, puis l'utilisateur sélectionne les quatre coins de
l'élément à mesurer dans l'ordre HG, HD, BD, BG.
"""
from __future__ import annotations

import math
from typing import Any, Callable

import gradio as gr


BLACK_THRESHOLDS = (30, 40, 50, 60, 70)


def _order_points(points: Any, np):
    """Ordre identique au notebook : haut-gauche, haut-droit, bas-droit, bas-gauche."""
    points = np.asarray(points, dtype=np.float32).reshape(4, 2)
    center = points.mean(axis=0)
    angles = np.arctan2(points[:, 1] - center[1], points[:, 0] - center[0])
    ordered = points[np.argsort(angles)]
    start = np.argmin(ordered.sum(axis=1))
    ordered = np.roll(ordered, -start, axis=0)
    if ordered[1, 0] < ordered[3, 0]:
        ordered = ordered[[0, 3, 2, 1]]
    return ordered.astype(np.float32)


def _detect_reference_rectangle(image, real_width: float, real_height: float, cv2, np):
    """Copie de l'algorithme de détection du notebook fourni."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    expected_ratio = real_width / real_height
    candidates = []
    image_area = image.shape[0] * image.shape[1]

    for threshold in BLACK_THRESHOLDS:
        _, binary = cv2.threshold(gray, threshold, 255, cv2.THRESH_BINARY_INV)
        kernel = np.ones((9, 9), np.uint8)
        binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
        contours, _ = cv2.findContours(binary.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for contour in contours:
            area = cv2.contourArea(contour)
            if area < image_area * 0.0005 or area > image_area * 0.25:
                continue

            rect = cv2.minAreaRect(contour)
            width, height = rect[1]
            if width <= 0 or height <= 0:
                continue

            ratio = max(width, height) / min(width, height)
            ratio_error = abs(math.log(ratio / expected_ratio))
            if ratio_error > math.log(2):
                continue

            rectangularity = area / (width * height)
            if rectangularity < 0.55:
                continue

            corners = _order_points(cv2.boxPoints(rect), np)
            score = area * rectangularity * math.exp(-ratio_error * 2)
            candidates.append(
                {
                    "score": score,
                    "corners": corners,
                    "threshold": threshold,
                    "ratio": ratio,
                    "rectangularity": rectangularity,
                }
            )

    if not candidates:
        raise ValueError(
            "Aucun rectangle noir n'a été détecté. Vérifiez son contraste, sa visibilité et ses dimensions."
        )

    return max(candidates, key=lambda item: item["score"])


def _draw_points(photo_bgr, points, cv2, np):
    result = photo_bgr.copy()
    for index, (x, y) in enumerate(points):
        cv2.circle(result, (int(x), int(y)), 12, (255, 0, 0), -1)
        cv2.putText(
            result,
            str(index + 1),
            (int(x) + 12, int(y) - 12),
            cv2.FONT_HERSHEY_SIMPLEX,
            1,
            (255, 255, 0),
            3,
        )

    if len(points) >= 2:
        cv2.polylines(
            result,
            [np.asarray(points, dtype=np.int32)],
            len(points) == 4,
            (0, 255, 0),
            4,
        )
    return cv2.cvtColor(result, cv2.COLOR_BGR2RGB)


def create_photo_measurement_ui(get_session: Callable[[str], dict[str, Any] | None]):
    """Construit une interface Gradio montée sous ``/photo-metre`` par FastAPI."""
    import cv2
    import numpy as np

    def initialise(session_token: str):
        session = get_session(session_token)
        if session is None:
            raise gr.Error("Cette photo n'est plus disponible. Retournez dans Devis IA et importez-la à nouveau.")
        image = cv2.imdecode(np.frombuffer(session["data"], dtype=np.uint8), cv2.IMREAD_COLOR)
        if image is None:
            raise gr.Error("La photo n'a pas pu être décodée.")
        photo_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        return (
            session_token,
            image,
            photo_rgb,
            photo_rgb,
            [],
            float(session.get("reference_width_cm", 22.0)),
            float(session.get("reference_height_cm", 17.8)),
            "0/4 points sélectionnés. Commencez par le coin haut gauche.",
            "",
        )

    def add_point(points, photo_bgr, event: gr.SelectData):
        if photo_bgr is None:
            raise gr.Error("La photo n'est pas encore chargée.")
        points = list(points or [])
        if len(points) >= 4:
            return points, _draw_points(photo_bgr, points, cv2, np), "4 points déjà sélectionnés. Réinitialisez pour recommencer."
        if event.index is None:
            return points, _draw_points(photo_bgr, points, cv2, np), "Coordonnées du clic indisponibles."

        x, y = event.index
        height, width = photo_bgr.shape[:2]
        points.append([int(np.clip(x, 0, width - 1)), int(np.clip(y, 0, height - 1))])
        preview = _draw_points(photo_bgr, points, cv2, np)
        if len(points) < 4:
            status = f"{len(points)}/4 points sélectionnés. Sélectionnez le coin numéro {len(points) + 1}."
        else:
            status = "4 points sélectionnés. Vérifiez le contour puis cliquez sur Calculer."
        return points, preview, status

    def calculate(points, photo_bgr, real_width, real_height):
        points = list(points or [])
        if photo_bgr is None:
            raise gr.Error("La photo n'est pas encore chargée.")
        if len(points) != 4:
            raise gr.Error("Sélectionnez les quatre coins de l'élément.")
        if real_width is None or real_height is None or real_width <= 0 or real_height <= 0:
            raise gr.Error("Les dimensions du rectangle de référence doivent être strictement positives.")

        corners = np.asarray(points, dtype=np.float32)
        if not cv2.isContourConvex(corners.reshape(-1, 1, 2)):
            raise gr.Error("Les points ne forment pas un quadrilatère convexe. Recommencez.")

        detected = _detect_reference_rectangle(photo_bgr, float(real_width), float(real_height), cv2, np)
        reference_real = np.array(
            [[0, 0], [real_width, 0], [real_width, real_height], [0, real_height]], dtype=np.float32
        )
        transform = cv2.getPerspectiveTransform(detected["corners"].astype(np.float32), reference_real)
        real_points = cv2.perspectiveTransform(corners.reshape(1, 4, 2), transform)[0]
        top_left, top_right, bottom_right, bottom_left = real_points
        width_cm = (np.linalg.norm(top_right - top_left) + np.linalg.norm(bottom_right - bottom_left)) / 2
        height_cm = (np.linalg.norm(bottom_left - top_left) + np.linalg.norm(bottom_right - top_right)) / 2
        if width_cm <= 0 or height_cm <= 0:
            raise gr.Error("Dimensions calculées invalides.")

        result = _draw_points(photo_bgr, points, cv2, np)
        result_bgr = cv2.cvtColor(result, cv2.COLOR_RGB2BGR)
        cv2.putText(result_bgr, f"Largeur: {width_cm:.2f} cm", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
        cv2.putText(result_bgr, f"Hauteur: {height_cm:.2f} cm", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)
        report = (
            f"Largeur : {width_cm:.2f} cm\\n"
            f"Hauteur : {height_cm:.2f} cm\\n"
            f"Surface : {width_cm * height_cm / 10_000:.4f} m²\\n\\n"
            f"Détection du rectangle : seuil {detected['threshold']}, "
            f"rectangularité {detected['rectangularity']:.3f}."
        )
        return cv2.cvtColor(result_bgr, cv2.COLOR_BGR2RGB), report

    def reset_selection(photo_bgr):
        if photo_bgr is None:
            return [], None, "Importez une photo depuis Devis IA.", ""
        return [], cv2.cvtColor(photo_bgr, cv2.COLOR_BGR2RGB), "Sélection réinitialisée. Recommencez par le coin haut gauche.", ""

    with gr.Blocks(title="Devis IA - Mesure photographique") as demo:
        gr.Markdown("# Mesure photographique")
        gr.Markdown(
            "La photo a été transmise depuis Devis IA. Saisissez les dimensions du rectangle noir, "
            "puis cliquez les quatre coins de l'élément : haut gauche, haut droit, bas droit, bas gauche."
        )
        session_token = gr.Textbox(visible=False)
        photo_state = gr.State()
        points_state = gr.State([])

        with gr.Row():
            reference_width = gr.Number(label="Largeur réelle du rectangle noir (cm)", precision=2)
            reference_height = gr.Number(label="Hauteur réelle du rectangle noir (cm)", precision=2)

        image_input = gr.Image(label="Cliquez les quatre coins de l'élément", type="numpy", interactive=True)
        status = gr.Textbox(label="État de la sélection", interactive=False)
        preview = gr.Image(label="Visualisation des points", type="numpy", interactive=False)
        with gr.Row():
            reset_button = gr.Button("Recommencer")
            calculate_button = gr.Button("Calculer les dimensions", variant="primary")
        result = gr.Textbox(label="Dimensions calculées", lines=5, interactive=False)

        demo.load(
            initialise,
            inputs=[session_token],
            outputs=[
                session_token,
                photo_state,
                image_input,
                preview,
                points_state,
                reference_width,
                reference_height,
                status,
                result,
            ],
            js="() => [new URLSearchParams(window.location.search).get('session') || '']",
        )
        image_input.select(add_point, inputs=[points_state, photo_state], outputs=[points_state, preview, status])
        calculate_button.click(calculate, inputs=[points_state, photo_state, reference_width, reference_height], outputs=[preview, result])
        reset_button.click(reset_selection, inputs=[photo_state], outputs=[points_state, preview, status, result])

    return demo
