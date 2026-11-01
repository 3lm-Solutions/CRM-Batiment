"""
Script de vérification locale du pipeline devis IA.

Usage (depuis la racine ai-service, venv activé) :

    python test_pipeline.py --marges          # sans DB ni API
    python test_pipeline.py --health          # deps + connexion Postgres
    python test_pipeline.py --full            # pipeline complet (LLM + DB)

Variables : voir catalogue/.env.example et toolregistry/.env.example
(copier vers .env à la racine).
"""
from __future__ import annotations

import argparse
import sys

import bootstrap  # noqa: F401 — charge .env


def test_marges() -> None:
    # Import direct du fichier pour ne pas charger catalogue/toolregistry (pas de deps).
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "marges", bootstrap.ROOT / "devis_generation" / "marges.py"
    )
    marges = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(marges)
    calcul_marges = marges.calcul_marges
    peut_envoyer_devis = marges.peut_envoyer_devis

    lignes = [{"totalHT": 1000, "coutTotal": 800}]
    resultat = calcul_marges(lignes)
    assert resultat["marge_pourcent"] == 20.0
    assert peut_envoyer_devis(resultat) is True

    lignes_remise = [
        {"totalHT": 10000, "coutTotal": 8000},
        {"totalHT": -2000, "coutTotal": 0},
    ]
    alerte = calcul_marges(lignes_remise)
    assert alerte["marge_pourcent"] < 15
    assert peut_envoyer_devis(alerte) is False

    print("OK — calcul_marges / peut_envoyer_devis")


def test_health() -> None:
    import psycopg2

    from catalogue.repository import fetch_prestations

    dsn = bootstrap.ROOT.joinpath(".env")
    if not dsn.exists():
        print("ATTENTION : fichier .env absent à la racine (copier depuis .env.example)")

    rows = fetch_prestations(company_id=1)
    print(f"OK — Postgres accessible, {len(rows)} prestation(s) pour company_id=1")


def test_full(description: str, company_id: int, client_id: int, createur_id: int, taux_marge: float) -> None:
    from devis_generation import (
        appliquer_marge_et_verifier,
        demarrer_generation_devis,
        valider_et_sauvegarder,
    )
    from devis_generation.marges import peut_envoyer_devis

    print(f"Description : {description!r}")
    devis = demarrer_generation_devis(
        description, company_id, client_id, createur_id=createur_id
    )
    print(f"Devis brouillon créé : id={devis.devis_id}, {len(devis.occurrences)} occurrence(s)")

    for occ in devis.occurrences:
        print("OCCURRENCE :", occ)

    for occ in devis.occurrences:
        if occ.quantite_ouvrage is None:
            occ.quantite_ouvrage = 1.0
            print(f"  → quantité par défaut 1 {occ.unite} pour « {occ.nom} »")

    etat = appliquer_marge_et_verifier(devis, taux_marge=taux_marge)
    print("\n=== DÉTAIL DU CALCUL ===")

    for occ in devis.occurrences:
        print(f"\nPrestation : {occ.nom}")
        print(f"Quantité ouvrage : {occ.quantite_ouvrage} {occ.unite}")

        for comp in occ.composants:
            print(f"  Composant : {comp.nom}")
            print(f"    Quantité par unité : {comp.quantite_par_unite}")
            print(f"    Quantité calculée : {comp.quantite_calculee}")
            print(f"    Coût unitaire : {comp.cout_unitaire}")
            print(f"    Prix vente unitaire : {comp.prix_vente_unitaire}")
            print(f"    Total HT : {comp.total_ht}")
            print(f"    Coût total : {comp.cout_total}")
            
    print(f"Marge {taux_marge:.0%} — alertes fourchette : {len(etat['alertes_fourchette'])}")
    if etat["quantites_manquantes"]:
        print("BLOQUÉ — quantités manquantes :", etat["quantites_manquantes"])
        sys.exit(1)

    resultat = valider_et_sauvegarder(devis)
    print(f"Sauvegardé — marge marque {resultat['marge_pourcent']}%, envoi autorisé : {peut_envoyer_devis(resultat)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Vérification locale du pipeline devis IA")
    parser.add_argument("--marges", action="store_true", help="Test unitaire marges (sans DB/API)")
    parser.add_argument("--health", action="store_true", help="Test connexion Postgres + catalogue")
    parser.add_argument("--full", action="store_true", help="Pipeline complet (LLM + DB)")
    parser.add_argument("--description", default="Pose de carrelage au sol 60x60 sur chape existante avec plinthes périphériques et joints hydrofuges. Prévoir système d'étanchéité sous carrelage.")
    parser.add_argument("--company-id", type=int, default=1)
    parser.add_argument("--client-id", type=int, default=1)
    parser.add_argument("--createur-id", type=int, default=1)
    parser.add_argument("--taux-marge", type=float, default=0.30)
    args = parser.parse_args()

    if not (args.marges or args.health or args.full):
        parser.print_help()
        print("\nExemple : python test_pipeline.py --marges")
        sys.exit(0)

    if args.marges:
        test_marges()
    if args.health:
        test_health()
    if args.full:
        test_full(
            args.description,
            args.company_id,
            args.client_id,
            args.createur_id,
            args.taux_marge,
        )


if __name__ == "__main__":
    main()
