"""Conversion des dataclasses du pipeline en dicts JSON-serialisables."""
from dataclasses import asdict
from typing import Any, Dict, List

from devis_generation.models import ComposantCalcule, DevisEnConstruction, OccurrencePrestation


def composant_to_dict(c: ComposantCalcule) -> Dict[str, Any]:
    return asdict(c)


def occurrence_to_dict(o: OccurrencePrestation) -> Dict[str, Any]:
    d = asdict(o)
    d["composants"] = [composant_to_dict(c) for c in o.composants]
    return d


def devis_to_dict(d: DevisEnConstruction) -> Dict[str, Any]:
    return {
        "devis_id": d.devis_id,
        "company_id": d.company_id,
        "client_id": d.client_id,
        "createur_id": d.createur_id,
        "taux_marge": d.taux_marge,
        "tva_pourcent": d.tva_pourcent,
        "remise_ht": d.remise_ht,
        "remise_libelle": d.remise_libelle,
        "occurrences": [occurrence_to_dict(o) for o in d.occurrences],
    }


def session_to_dict(payload: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(payload)
    out["occurrences"] = [occurrence_to_dict(o) for o in payload["occurrences"]]
    return out


def apply_quantite_updates(
    devis: DevisEnConstruction, updates: List[Dict[str, Any]]
) -> None:
    by_uid = {o.uid: o for o in devis.occurrences}
    for item in updates:
        occ = by_uid.get(item.get("uid"))
        if occ is None:
            continue
        q = item.get("quantite_ouvrage")
        if q is None or q == "":
            occ.quantite_ouvrage = None
        else:
            occ.quantite_ouvrage = float(q)


def apply_cout_updates(
    devis: DevisEnConstruction, updates: List[Dict[str, Any]]
) -> None:
    by_uid = {o.uid: o for o in devis.occurrences}
    for item in updates:
        occ = by_uid.get(item.get("uid"))
        if occ is None:
            continue
        c = item.get("cout_unitaire_manuel")
        if c is None or c == "":
            occ.cout_unitaire_manuel = None
        else:
            valeur = float(c)
            if valeur < 0:
                raise ValueError("Le coût unitaire doit être positif ou nul.")
            occ.cout_unitaire_manuel = round(valeur, 2)


def apply_remise_update(devis: DevisEnConstruction, remise_ht: Any, remise_libelle: Any = None) -> None:
    """Met à jour la remise de session; une remise ne peut pas être négative."""
    montant = 0.0 if remise_ht in (None, "") else float(remise_ht)
    if montant < 0:
        raise ValueError("Le montant de remise doit être positif ou nul.")
    devis.remise_ht = round(montant, 2)
    if remise_libelle is not None:
        devis.remise_libelle = str(remise_libelle).strip() or "Remise commerciale"
