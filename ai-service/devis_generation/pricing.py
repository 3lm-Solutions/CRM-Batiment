"""
Résolution du JSON retourné par le LLM en occurrences de prestations avec
leurs composants (étapes 2 et 3 du flux), puis calcul des prix de vente à
partir du taux de marge saisi par le commercial (étape 5), et vérifications
associées (étapes 4 et... la vérification de quantité manquante).
"""
from typing import Dict, List

from . import repository
from .models import ComposantCalcule, OccurrencePrestation


def _ligne_composition_vers_composant(row: dict) -> ComposantCalcule:
    """Convertit une ligne SQL (PrestationComposition ou ChoixOptionComposition,
    même forme dans les deux cas) en ComposantCalcule. Une ligne a soit un
    materiau_id soit un service_id, jamais les deux (contrainte du schéma)."""
    if row["materiau_id"] is not None:
        return ComposantCalcule(
            type="materiau",
            id=row["materiau_id"],
            nom=row["materiau_nom"],
            unite=row["materiau_unite"],
            quantite_par_unite=row["quantite_par_unite"],
            cout_unitaire=row["materiau_cout"],
        )
    return ComposantCalcule(
        type="service_main_oeuvre",
        id=row["service_id"],
        nom=row["service_nom"],
        unite=row["service_unite"],
        quantite_par_unite=row["quantite_par_unite"],
        cout_unitaire=row["service_cout"],
    )


def construire_occurrence(
    prestation_id: int,
    quantite_ouvrage=None,
    options_choisies=None,
    choix_option_ids=None,
    company_id=None,
    uid: str = None,
) -> OccurrencePrestation:
    """Résout une prestation catalogue en occurrence (composants de base + options)."""
    options_choisies = options_choisies or []
    prestation = repository.fetch_prestation_full(prestation_id, company_id=company_id)

    composants = [
        _ligne_composition_vers_composant(row)
        for row in repository.fetch_prestation_composition(prestation_id)
    ]

    if choix_option_ids is None:
        # Chemin conservé pour les cases à cocher de l'interface actuelle.
        choix_option_ids = [
            choix_id
            for option_nom in options_choisies
            if (choix_id := repository.fetch_choix_option_id_by_name(prestation_id, option_nom))
            is not None
        ]

    for choix_option_id in choix_option_ids:
        composants += [
            _ligne_composition_vers_composant(row)
            for row in repository.fetch_choix_option_composition(choix_option_id)
        ]

    kwargs = dict(
        prestation_id=prestation_id,
        nom=prestation["nom"],
        unite=prestation["unite"],
        prix_vente_min=prestation["prix_vente_min"],
        prix_vente_max=prestation["prix_vente_max"],
        quantite_ouvrage=quantite_ouvrage,
        composants=composants,
        options_choisies=list(options_choisies),
        choix_option_ids=list(choix_option_ids),
        options_disponibles=repository.fetch_choix_option_noms(prestation_id),
    )
    if uid:
        kwargs["uid"] = uid
    return OccurrencePrestation(**kwargs)


def resoudre_occurrences(raw_llm_json: dict, company_id=None) -> List[OccurrencePrestation]:
    """
    À partir du JSON du LLM ({"prestations": [{"prestation_id", "quantite_ouvrage",
    "options": [{"option_id", "choix_id"}]}]}), vérifie chaque identifiant
    auprès de la BD avant de charger les composants réels de la prestation et
    des choix d'option. Le LLM ne fournit donc jamais de donnée de prix.
    """
    occurrences = []

    for item in raw_llm_json.get("prestations", []):
        prestation_id = item["prestation_id"]
        selections = item.get("options") or []
        choix_option_ids = []
        choix_option_noms = []
        option_ids_vus = set()
        for selection in selections:
            if not isinstance(selection, dict):
                raise ValueError("Format d'option LLM invalide : objet attendu.")
            option_id = selection.get("option_id")
            choix_id = selection.get("choix_id")
            if type(option_id) is not int or type(choix_id) is not int:
                raise ValueError("Format d'option LLM invalide : option_id et choix_id entiers requis.")
            if option_id in option_ids_vus:
                raise ValueError(f"Plusieurs choix ont été fournis pour l'option {option_id}.")
            choix = repository.fetch_choix_option_for_selection(
                prestation_id, option_id, choix_id, company_id=company_id
            )
            if choix is None:
                raise ValueError(
                    f"Sélection LLM invalide : choix {choix_id} non lié à l'option {option_id} "
                    f"de la prestation {prestation_id}."
                )
            option_ids_vus.add(option_id)
            choix_option_ids.append(choix_id)
            choix_option_noms.append(choix["nom"])
        occurrences.append(
            construire_occurrence(
                prestation_id=prestation_id,
                quantite_ouvrage=item.get("quantite_ouvrage"),
                options_choisies=choix_option_noms,
                choix_option_ids=choix_option_ids,
                company_id=company_id,
            )
        )

    return occurrences


def appliquer_taux_marge(occurrences: List[OccurrencePrestation], taux_marge: float) -> None:
    """
    Calcule, pour chaque composant de chaque occurrence :
        prix_vente_unitaire = cout_unitaire * (1 + taux_marge)   [taux de MARGE, base = coût]
    Si la quantité d'ouvrage de l'occurrence est absente (None), les quantités
    et totaux restent à 0 — le blocage d'envoi est géré séparément par
    verifier_quantites_manquantes(), pas ici.

    Mutation en place (modifie les objets passés en argument).
    """
    for occ in occurrences:
        if not occ.composants:
            cout = occ.cout_unitaire_manuel
            if cout is None or occ.quantite_ouvrage is None:
                occ.prix_vente_total = 0.0
            else:
                pu = round(float(cout) * (1 + taux_marge), 2)
                occ.prix_vente_total = round(pu * occ.quantite_ouvrage, 2)
            continue

        for comp in occ.composants:
            comp.prix_vente_unitaire = round(comp.cout_unitaire * (1 + taux_marge), 2)

            if occ.quantite_ouvrage is None:
                comp.quantite_calculee = 0.0
                comp.total_ht = 0.0
                comp.cout_total = 0.0
            else:
                comp.quantite_calculee = round(comp.quantite_par_unite * occ.quantite_ouvrage, 4)
                comp.total_ht = round(comp.quantite_calculee * comp.prix_vente_unitaire, 2)
                comp.cout_total = round(comp.quantite_calculee * comp.cout_unitaire, 2)

        occ.prix_vente_total = round(sum(c.total_ht or 0.0 for c in occ.composants), 2)


def verifier_fourchette(occurrences: List[OccurrencePrestation]) -> List[Dict]:
    """
    Alerte NON bloquante par prestation dont le prix de vente calculé sort de
    [prixVenteMin, prixVenteMax]. Ne s'applique qu'aux occurrences dont la
    quantité d'ouvrage est renseignée (sinon prix = 0, comparaison sans sens).
    """
    alertes = []
    for occ in occurrences:
        occ.alerte_fourchette = None
        if occ.quantite_ouvrage is None:
            continue

        # prixVenteMin/prixVenteMax sont les bornes d'UNE unité de prestation.
        # Une occurrence porte sur plusieurs unités (m², ml, pièce...) : les
        # bornes de comparaison doivent donc être mises à l'échelle.
        borne_min = round(occ.prix_vente_min * occ.quantite_ouvrage, 2)
        borne_max = round(occ.prix_vente_max * occ.quantite_ouvrage, 2)

        if occ.prix_vente_total < borne_min:
            alerte = {
                "type": "FOURCHETTE_BASSE",
                "prestation_id": occ.prestation_id,
                "prestation_nom": occ.nom,
                "prix_calcule": occ.prix_vente_total,
                "borne": borne_min,
                "borne_min": borne_min,
                "borne_max": borne_max,
                "ecart": round(borne_min - occ.prix_vente_total, 2),
            }
        elif occ.prix_vente_total > borne_max:
            alerte = {
                "type": "FOURCHETTE_HAUTE",
                "prestation_id": occ.prestation_id,
                "prestation_nom": occ.nom,
                "prix_calcule": occ.prix_vente_total,
                "borne": borne_max,
                "borne_min": borne_min,
                "borne_max": borne_max,
                "ecart": round(occ.prix_vente_total - borne_max, 2),
            }
        else:
            continue

        occ.alerte_fourchette = alerte
        alertes.append(alerte)

    return alertes


def verifier_quantites_manquantes(occurrences: List[OccurrencePrestation]) -> List[Dict]:
    """
    Vérification BLOQUANTE, sans justification possible (contrairement à la
    marge globale) : retourne les occurrences dont la quantité d'ouvrage n'a
    pas été renseignée. Le devis ne peut pas être sauvegardé/envoyé tant que
    cette liste n'est pas vide.
    """
    return [
        {
            "uid": occ.uid,
            "prestation_id": occ.prestation_id,
            "prestation_nom": occ.nom,
        }
        for occ in occurrences
        if occ.quantite_ouvrage is None
    ]


def verifier_couts_manuels_manquants(occurrences: List[OccurrencePrestation]) -> List[Dict]:
    """Prestations sans composition catalogue et sans coût unitaire saisi."""
    return [
        {
            "uid": occ.uid,
            "prestation_id": occ.prestation_id,
            "prestation_nom": occ.nom,
        }
        for occ in occurrences
        if not occ.composants and occ.cout_unitaire_manuel is None
    ]
