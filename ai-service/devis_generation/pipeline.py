"""
Orchestration du pipeline texte complet (étapes 1 à 11 du flux détaillé dans
la conversation). Trois points d'entrée, correspondant aux trois moments où
le code métier (endpoint /api/devis/*) doit intervenir :

1. demarrer_generation_devis()   -> appelé une fois, à la saisie de la description
2. appliquer_marge_et_verifier() -> appelé à chaque fois que le commercial
                                     saisit/change son taux de marge dans
                                     l'interface de validation
3. valider_et_sauvegarder()      -> appelé quand le commercial valide définitivement
"""
from typing import Dict, List, Optional

from catalogue import get_catalogue_provider
from toolregistry import ToolRegistry

from . import repository
from .marges import calcul_marges, peut_envoyer_devis
from .models import DevisEnConstruction
from .pricing import (
    appliquer_taux_marge,
    construire_occurrence,
    resoudre_occurrences,
    verifier_couts_manuels_manquants,
    verifier_fourchette,
    verifier_quantites_manquantes,
)


def demarrer_generation_devis(
    description: str,
    company_id: int,
    client_id: int,
    createur_id: Optional[int] = None,
    demande_devis_id: Optional[int] = None,
) -> DevisEnConstruction:
    """
    Étapes 1 à 4 du flux : construit le contexte catalogue (few-shot ou RAG
    selon la config), appelle le LLM, résout les prestations détectées en
    occurrences avec leurs composants, et crée le Devis en BROUILLON.

    La description peut venir directement d'une saisie texte, ou d'une
    transcription vocale (Whisper) — ce pipeline ne fait aucune différence,
    conformément à la décision prise : le vocal réutilise le pipeline texte.
    """
    catalogue_provider = get_catalogue_provider()
    registry = ToolRegistry()

    system_prompt = catalogue_provider.build_system_prompt(description, company_id)
    resultat_llm = registry.generate_devis_from_text(description, system_prompt=system_prompt)

    occurrences = resoudre_occurrences(resultat_llm.raw_json, company_id=company_id)

    devis_id = repository.create_devis_brouillon(
        company_id=company_id,
        client_id=client_id,
        createur_id=createur_id,
        demande_devis_id=demande_devis_id,
    )
    tva_pourcent = repository.fetch_tva_defaut_by_company(company_id)

    return DevisEnConstruction(
        devis_id=devis_id,
        company_id=company_id,
        client_id=client_id,
        createur_id=createur_id,
        occurrences=occurrences,
        tva_pourcent=tva_pourcent,
    )


def appliquer_marge_et_verifier(devis: DevisEnConstruction, taux_marge: float) -> Dict:
    """
    Étapes 6 et 7 du flux (côté données, pas encore de sauvegarde) : applique
    le taux de marge saisi par le commercial, calcule les prix, vérifie la
    fourchette catalogue (non bloquant) et les quantités d'ouvrage manquantes
    (bloquant). À appeler à chaque changement de la marge dans l'interface.

    Ne touche pas la base de données — tout se passe en mémoire, cohérent
    avec la décision "session continue, pas de lecture/écriture LigneDevis
    pendant la validation".
    """
    devis.taux_marge = taux_marge
    appliquer_taux_marge(devis.occurrences, taux_marge)

    alertes_fourchette = verifier_fourchette(devis.occurrences)
    quantites_manquantes = verifier_quantites_manquantes(devis.occurrences)
    couts_manquants = verifier_couts_manuels_manquants(devis.occurrences)

    return {
        "occurrences": devis.occurrences,
        "alertes_fourchette": alertes_fourchette,
        "quantites_manquantes": quantites_manquantes,
        "couts_manquants": couts_manquants,
        "envoi_bloque_quantite_manquante": len(quantites_manquantes) > 0,
        "envoi_bloque_cout_manquant": len(couts_manquants) > 0,
    }


def aplatir_lignes(devis: DevisEnConstruction) -> List[dict]:
    lignes = []
    taux = devis.taux_marge if devis.taux_marge is not None else 0.0
    for occ in devis.occurrences:
        if not occ.composants:
            if occ.cout_unitaire_manuel is None:
                continue
            qte = occ.quantite_ouvrage or 0.0
            pu = round(float(occ.cout_unitaire_manuel) * (1 + taux), 2)
            lignes.append(
                {
                    "prestationId": occ.prestation_id,
                    "description": occ.nom,
                    "materiauId": None,
                    "serviceMainOeuvreId": None,
                    "quantite": qte,
                    "unite": occ.unite,
                    "prixUnitaireVente": pu,
                    "prixAchat": 0,
                    "mainOeuvre": occ.cout_unitaire_manuel,
                    "totalHT": round(qte * pu, 2),
                    "coutTotal": round(qte * float(occ.cout_unitaire_manuel), 2),
                }
            )
            continue
        for comp in occ.composants:
            lignes.append(
                {
                    "prestationId": occ.prestation_id,
                    "description": comp.nom,
                    "materiauId": comp.id if comp.type == "materiau" else None,
                    "serviceMainOeuvreId": comp.id if comp.type == "service_main_oeuvre" else None,
                    "quantite": comp.quantite_calculee or 0,
                    "unite": comp.unite,
                    "prixUnitaireVente": comp.prix_vente_unitaire or 0,
                    "prixAchat": comp.cout_unitaire if comp.type == "materiau" else 0,
                    "mainOeuvre": comp.cout_unitaire if comp.type == "service_main_oeuvre" else 0,
                    "totalHT": comp.total_ht or 0,
                    "coutTotal": comp.cout_total or 0,
                }
            )
    if devis.remise_ht > 0:
        lignes.append(
            {
                "prestationId": None,
                "description": devis.remise_libelle or "Remise commerciale",
                "materiauId": None,
                "serviceMainOeuvreId": None,
                "quantite": 1,
                "unite": "FORFAIT",
                "prixUnitaireVente": -round(devis.remise_ht, 2),
                "prixAchat": 0,
                "mainOeuvre": 0,
                "totalHT": -round(devis.remise_ht, 2),
                "coutTotal": 0,
            }
        )
    return lignes


def apercu_session(devis: DevisEnConstruction) -> Dict:
    """Totaux + alerte de marque + aperçu plat, sans écrire en base."""
    taux = devis.taux_marge if devis.taux_marge is not None else 0.0
    etat = appliquer_marge_et_verifier(devis, taux)
    lignes = aplatir_lignes(devis)
    resultat_marge = calcul_marges(lignes) if lignes else {
        "marge_total_eur": 0.0,
        "marge_pourcent": 0.0,
        "alertes": [{"type": "MARGE_INSUFFISANTE", "marge_pourcent": 0.0, "seuil": 15, "message": "Aucune ligne à tarifer."}],
    }
    total_ht = round(sum(l["totalHT"] for l in lignes), 2)
    total_tva = round(total_ht * devis.tva_pourcent / 100, 2)
    raisons = []
    if etat["envoi_bloque_quantite_manquante"]:
        n = len(etat["quantites_manquantes"])
        raisons.append(f"{n} quantité{'s' if n > 1 else ''} manquante{'s' if n > 1 else ''}")
    if etat["envoi_bloque_cout_manquant"]:
        n = len(etat["couts_manquants"])
        raisons.append(f"{n} coût{'s' if n > 1 else ''} unitaire{'s' if n > 1 else ''} à saisir")
    if not peut_envoyer_devis(resultat_marge):
        for a in resultat_marge["alertes"]:
            raisons.append(a["message"])

    return {
        "devis_id": devis.devis_id,
        "company_id": devis.company_id,
        "client_id": devis.client_id,
        "taux_marge": devis.taux_marge,
        "tva_pourcent": devis.tva_pourcent,
        "remise_ht": devis.remise_ht,
        "remise_libelle": devis.remise_libelle,
        "occurrences": devis.occurrences,
        "alertes_fourchette": etat["alertes_fourchette"],
        "quantites_manquantes": etat["quantites_manquantes"],
        "couts_manquants": etat["couts_manquants"],
        "envoi_bloque_quantite_manquante": etat["envoi_bloque_quantite_manquante"],
        "envoi_bloque_cout_manquant": etat["envoi_bloque_cout_manquant"],
        "total_ht": total_ht,
        "total_tva": total_tva,
        "total_ttc": round(total_ht + total_tva, 2),
        "resultat_marge": resultat_marge,
        "peut_envoyer": (
            (not etat["envoi_bloque_quantite_manquante"])
            and (not etat["envoi_bloque_cout_manquant"])
            and peut_envoyer_devis(resultat_marge)
        ),
        "raisons_blocage": raisons,
        "lignes_apercu": lignes,
    }


def appliquer_options_occurrence(devis: DevisEnConstruction, uid: str, options_choisies: List[str]) -> None:
    occ = _occ_by_uid(devis, uid)
    rebuilt = construire_occurrence(
        prestation_id=occ.prestation_id,
        quantite_ouvrage=occ.quantite_ouvrage,
        options_choisies=options_choisies,
        company_id=devis.company_id,
        uid=occ.uid,
    )
    rebuilt.cout_unitaire_manuel = occ.cout_unitaire_manuel
    idx = devis.occurrences.index(occ)
    devis.occurrences[idx] = rebuilt


def ajouter_occurrence(
    devis: DevisEnConstruction,
    prestation_id: int,
    quantite_ouvrage=None,
    options_choisies=None,
) -> None:
    devis.occurrences.append(
        construire_occurrence(
            prestation_id,
            quantite_ouvrage,
            options_choisies or [],
            company_id=devis.company_id,
        )
    )


def supprimer_occurrence(devis: DevisEnConstruction, uid: str) -> None:
    devis.occurrences = [o for o in devis.occurrences if o.uid != uid]


def _occ_by_uid(devis: DevisEnConstruction, uid: str):
    for occ in devis.occurrences:
        if occ.uid == uid:
            return occ
    raise ValueError(f"Occurrence introuvable : {uid}")


def valider_et_sauvegarder(devis: DevisEnConstruction) -> Dict:
    """
    Étapes 9 et 11 du flux : aplatit les occurrences en lignes LigneDevis
    (une ligne par composant, sans champ de regroupement) et les persiste.
    Met aussi à jour les totaux du Devis avec le taux de marque calculé
    (calcul_marges), mais ne décide PAS si l'envoi est autorisé — voir
    marges.peut_envoyer_devis() pour ça, appelé séparément par l'endpoint.

    Lève ValueError si une quantité d'ouvrage manque encore (blocage strict,
    sans justification possible — différent du blocage sur la marge).
    """
    manquantes = verifier_quantites_manquantes(devis.occurrences)
    if manquantes:
        noms = [m["prestation_nom"] for m in manquantes]
        raise ValueError(
            f"Impossible de sauvegarder : quantité d'ouvrage manquante pour : {', '.join(noms)}"
        )
    couts_manquants = verifier_couts_manuels_manquants(devis.occurrences)
    if couts_manquants:
        noms = [c["prestation_nom"] for c in couts_manquants]
        raise ValueError(
            f"Impossible de sauvegarder : coût unitaire à saisir pour : {', '.join(noms)}"
        )

    lignes = aplatir_lignes(devis)

    repository.save_lignes_devis(devis.devis_id, lignes)

    resultat_marge = calcul_marges(lignes)
    repository.update_devis_totaux(
        devis.devis_id,
        total_ht=sum(l["totalHT"] for l in lignes),
        cout_total=sum(l["coutTotal"] for l in lignes),
        marge_pourcent=resultat_marge["marge_pourcent"],
        tva_pourcent=devis.tva_pourcent,
    )

    return resultat_marge


def enregistrer_brouillon(devis: DevisEnConstruction) -> Dict:
    """Sauvegarde sans bloquer sur les quantités manquantes ni sur la marge."""
    if devis.taux_marge is None:
        appliquer_marge_et_verifier(devis, 0.0)
    lignes = aplatir_lignes(devis)
    repository.save_lignes_devis(devis.devis_id, lignes)
    resultat_marge = calcul_marges(lignes) if lignes else {
        "marge_total_eur": 0.0,
        "marge_pourcent": 0.0,
        "alertes": [],
    }
    repository.update_devis_totaux(
        devis.devis_id,
        total_ht=sum(l["totalHT"] for l in lignes),
        cout_total=sum(l["coutTotal"] for l in lignes),
        marge_pourcent=resultat_marge["marge_pourcent"],
        tva_pourcent=devis.tva_pourcent,
    )
    numero_version = repository.create_version_devis(
        devis_id=devis.devis_id,
        auteur_id=devis.createur_id,
        lignes=lignes,
        total_ht=sum(l["totalHT"] for l in lignes),
        total_ttc=sum(l["totalHT"] for l in lignes) * (1 + devis.tva_pourcent / 100),
        profit=resultat_marge["marge_total_eur"],
        marge_pourcent=resultat_marge["marge_pourcent"],
    )
    resultat_marge["numero_version"] = numero_version
    return resultat_marge


def envoyer_devis(devis: DevisEnConstruction, email_client: str) -> Dict:
    """Valide, produit le PDF et l'envoie avant de passer le devis à ENVOYE."""
    resultat_marge = valider_et_sauvegarder(devis)
    if not peut_envoyer_devis(resultat_marge):
        raise ValueError(
            "Envoi bloqué : " + "; ".join(a["message"] for a in resultat_marge["alertes"])
        )
    from .email_sender import send_devis_pdf
    from .pdf_export import build_devis_pdf

    export = repository.fetch_devis_export_data(devis.devis_id)
    send_devis_pdf(email_client, export["devis"]["reference"], build_devis_pdf(export))
    repository.update_devis_statut(devis.devis_id, "ENVOYE")
    return resultat_marge
