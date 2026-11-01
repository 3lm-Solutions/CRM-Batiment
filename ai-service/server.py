"""
Serveur FastAPI + interface graphique de test du pipeline devis IA.

    python server.py
    http://127.0.0.1:8000/
"""
from __future__ import annotations

from pathlib import Path
import re
from typing import Dict, List, Optional

import bootstrap  # noqa: F401 — charge .env
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from devis_generation import (
    appliquer_marge_et_verifier,
    demarrer_generation_devis,
)
from devis_generation.models import DevisEnConstruction
from devis_generation.pipeline import (
    ajouter_occurrence,
    apercu_session,
    appliquer_options_occurrence,
    enregistrer_brouillon,
    envoyer_devis,
    supprimer_occurrence,
)
from serialization import apply_cout_updates, apply_quantite_updates, apply_remise_update, session_to_dict
from toolregistry import ToolRegistry
from toolregistry.config import ToolRegistryConfig

FRONT = Path(__file__).resolve().parent / "frontend"

app = FastAPI(title="Devis IA", version="0.2.0")
app.mount("/static", StaticFiles(directory=str(FRONT)), name="static")

_sessions: Dict[int, DevisEnConstruction] = {}

PHOTO_PROMPT = """Analyse cette photo de chantier / pièce. Réponds UNIQUEMENT avec un JSON :
{
  "type_piece": "salle de bain | cuisine | salon | chambre | autre",
  "surface_estimee_m2": nombre ou null,
  "confidence_surface": nombre entre 0 et 1,
  "materiaux_identifies": ["liste de matériaux visibles"],
  "reference_visible": true ou false
}"""


class GenererRequest(BaseModel):
    description: str = Field(..., min_length=3)
    company_id: int = 1
    client_id: int = 1
    createur_id: Optional[int] = 1


class QuantiteUpdate(BaseModel):
    uid: str
    quantite_ouvrage: Optional[float] = None


class CoutUpdate(BaseModel):
    uid: str
    cout_unitaire_manuel: Optional[float] = None


class RecalcRequest(BaseModel):
    taux_marge: float = Field(..., ge=0, le=2)
    quantites: Optional[List[QuantiteUpdate]] = None
    couts: Optional[List[CoutUpdate]] = None
    remise_ht: float = Field(0, ge=0)
    remise_libelle: str = Field("Remise commerciale", max_length=120)


class OptionsRequest(BaseModel):
    uid: str
    options: List[str] = Field(default_factory=list)
    taux_marge: float = Field(0.30, ge=0, le=2)
    quantites: Optional[List[QuantiteUpdate]] = None
    couts: Optional[List[CoutUpdate]] = None


class AjoutPrestationRequest(BaseModel):
    prestation_id: int
    quantite_ouvrage: Optional[float] = None
    taux_marge: float = Field(0.30, ge=0, le=2)
    quantites: Optional[List[QuantiteUpdate]] = None
    couts: Optional[List[CoutUpdate]] = None


class EnvoyerDevisRequest(BaseModel):
    email_client: str = Field(..., min_length=3, max_length=320)


def _session(devis_id: int) -> DevisEnConstruction:
    devis = _sessions.get(devis_id)
    if devis is None:
        raise HTTPException(status_code=404, detail="Session devis introuvable (redémarrage serveur ?)")
    return devis


def _payload(devis: DevisEnConstruction) -> dict:
    return session_to_dict(apercu_session(devis))


def _vision_registry() -> ToolRegistry:
    cfg = ToolRegistryConfig()
    if cfg.vision_provider != "openai" and not (
        (cfg.vision_provider == "anthropic" and cfg.anthropic_api_key)
        or (cfg.vision_provider == "google" and cfg.google_api_key)
    ):
        if cfg.openai_api_key:
            cfg.vision_provider = "openai"
            cfg.vision_model = "gpt-4o-mini"
            cfg.vision_fallback_provider = None
            cfg.vision_fallback_model = None
    return ToolRegistry(cfg)


@app.get("/")
def index():
    return FileResponse(FRONT / "index.html")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/health/db")
def health_db(company_id: int = 1) -> dict:
    try:
        from catalogue.repository import fetch_prestations

        prestations = fetch_prestations(company_id)
        return {"status": "ok", "company_id": company_id, "prestations_count": len(prestations)}
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/catalogue")
def catalogue(company_id: int = 1) -> dict:
    from catalogue.repository import fetch_prestations

    try:
        rows = fetch_prestations(company_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {
        "prestations": [
            {
                "id": p.id,
                "nom": p.nom,
                "unite": p.unite,
                "categorie": p.categorie_nom,
                "options": p.options,
                "prix_vente_min": p.prix_vente_min,
                "prix_vente_max": p.prix_vente_max,
            }
            for p in rows
        ]
    }


@app.post("/api/devis/generer")
def generer_devis(body: GenererRequest) -> dict:
    try:
        devis = demarrer_generation_devis(
            description=body.description,
            company_id=body.company_id,
            client_id=body.client_id,
            createur_id=body.createur_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    appliquer_marge_et_verifier(devis, 0.30)
    _sessions[devis.devis_id] = devis
    return _payload(devis)


@app.get("/api/devis/{devis_id}")
def get_devis(devis_id: int) -> dict:
    return _payload(_session(devis_id))


@app.post("/api/devis/{devis_id}/recalculer")
def recalculer(devis_id: int, body: RecalcRequest) -> dict:
    devis = _session(devis_id)
    if body.quantites:
        apply_quantite_updates(devis, [q.model_dump() for q in body.quantites])
    try:
        if body.couts:
            apply_cout_updates(devis, [c.model_dump() for c in body.couts])
        apply_remise_update(devis, body.remise_ht, body.remise_libelle)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    appliquer_marge_et_verifier(devis, body.taux_marge)
    return _payload(devis)


def _apply_quantites(devis, updates: Optional[List[QuantiteUpdate]]) -> None:
    if updates:
        apply_quantite_updates(devis, [q.model_dump() for q in updates])


def _apply_couts(devis, updates: Optional[List[CoutUpdate]]) -> None:
    if updates:
        apply_cout_updates(devis, [c.model_dump() for c in updates])


@app.post("/api/devis/{devis_id}/options")
def maj_options(devis_id: int, body: OptionsRequest) -> dict:
    devis = _session(devis_id)
    _apply_quantites(devis, body.quantites)
    _apply_couts(devis, body.couts)
    try:
        appliquer_options_occurrence(devis, body.uid, body.options)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    appliquer_marge_et_verifier(devis, body.taux_marge)
    return _payload(devis)


@app.post("/api/devis/{devis_id}/ajouter")
def ajouter(devis_id: int, body: AjoutPrestationRequest) -> dict:
    devis = _session(devis_id)
    _apply_quantites(devis, body.quantites)
    _apply_couts(devis, body.couts)
    try:
        ajouter_occurrence(devis, body.prestation_id, body.quantite_ouvrage)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    appliquer_marge_et_verifier(devis, body.taux_marge)
    return _payload(devis)


@app.delete("/api/devis/{devis_id}/occurrences/{uid}")
def supprimer(devis_id: int, uid: str, taux_marge: float = 0.30) -> dict:
    devis = _session(devis_id)
    supprimer_occurrence(devis, uid)
    appliquer_marge_et_verifier(devis, taux_marge)
    return _payload(devis)


@app.post("/api/devis/{devis_id}/enregistrer")
def enregistrer(devis_id: int) -> dict:
    devis = _session(devis_id)
    try:
        resultat = enregistrer_brouillon(devis)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"ok": True, "statut": "BROUILLON", "resultat_marge": resultat, **_payload(devis)}


@app.post("/api/devis/{devis_id}/envoyer")
def envoyer(devis_id: int, body: EnvoyerDevisRequest) -> dict:
    devis = _session(devis_id)
    email_client = body.email_client.strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email_client):
        raise HTTPException(status_code=422, detail="Adresse e-mail client invalide.")
    try:
        resultat = envoyer_devis(devis, email_client=email_client)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    del _sessions[devis_id]
    return {
        "ok": True,
        "statut": "ENVOYE",
        "devis_id": devis_id,
        "email_client": email_client,
        "resultat_marge": resultat,
    }


@app.post("/api/photo/analyser")
async def analyser_photo(file: UploadFile = File(...)) -> dict:
    if file.content_type not in ("image/jpeg", "image/png"):
        raise HTTPException(status_code=400, detail="Formats acceptés : JPEG ou PNG.")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Fichier trop volumineux (10 Mo max).")
    import base64

    try:
        result = _vision_registry().analyze_photo(
            base64.b64encode(data).decode("ascii"),
            prompt=PHOTO_PROMPT,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    confidence = result.raw_json.get("confidence_surface")
    return {
        "type_piece": result.type_piece,
        "surface_estimee_m2": result.surface_estimee_m2,
        "confidence_surface": confidence,
        "materiaux_identifies": result.materiaux_identifies,
        "reference_visible": result.reference_visible,
        "provider": result.provider,
        "model": result.model,
    }


@app.post("/api/vocal/transcrire")
async def transcrire(file: UploadFile = File(...)) -> dict:
    data = await file.read()
    name = (file.filename or "audio.webm").lower()
    fmt = "webm"
    for ext in ("wav", "mp3", "m4a", "ogg", "webm", "mp4"):
        if name.endswith(ext):
            fmt = ext
            break
    try:
        result = ToolRegistry().transcribe_audio(data, audio_format=fmt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "transcription_texte": result.transcription_texte,
        "confidence_score": result.confidence_score,
        "duration_seconds": result.duration_seconds,
        "provider": result.provider,
        "model": result.model,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=True)
