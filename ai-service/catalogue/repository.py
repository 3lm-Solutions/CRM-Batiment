"""
Accès en lecture au catalogue (table `prestations` + relations), directement
en SQL sur la base Postgres partagée avec le schéma Prisma du CRM.

Ce service Python ne dépend pas du client Prisma (réservé à Node.js) : il lit
les mêmes tables via psycopg2, en respectant strictement les noms de
tables/colonnes générés par Prisma (camelCase entre guillemets, tables au
pluriel via @@map — voir shemaBD.pdf).

Note : ouvre une connexion par appel pour rester simple à ce stade. À
remplacer par un pool de connexions (ex: psycopg2.pool) avant la mise en
production, pour éviter le coût d'ouverture/fermeture répété.
"""
import os
from typing import List

import psycopg2
import psycopg2.extras

from .base import CataloguePrestation


def _get_connection():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError(
            "DATABASE_URL n'est pas configurée (voir catalogue/.env.example)"
        )
    return psycopg2.connect(dsn)


def fetch_prestations(company_id: int) -> List[CataloguePrestation]:
    """
    Récupère toutes les prestations actives d'une entreprise, avec leur
    catégorie et leurs options — utilisé aussi bien par le mode few-shot
    (tout le catalogue) que par le mode RAG (candidats avant filtrage).
    """
    query = """
        SELECT
            p.id,
            p.nom,
            p.unite,
            p."prixVenteMin"  AS prix_vente_min,
            p."prixVenteMax"  AS prix_vente_max,
            p.description,
            c.nom AS categorie_nom
        FROM prestations p
        LEFT JOIN categories_prestations c ON c.id = p."categorieId"
        WHERE p."companyId" = %s AND p.actif = true
        ORDER BY c.nom, p.nom
    """
    with _get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, (company_id,))
            rows = cur.fetchall()

    return [
        CataloguePrestation(
            id=row["id"],
            nom=row["nom"],
            unite=row["unite"],
            prix_vente_min=row["prix_vente_min"],
            prix_vente_max=row["prix_vente_max"],
            description=row["description"],
            categorie_nom=row["categorie_nom"],
            options=_fetch_options(row["id"]),
        )
        for row in rows
    ]


def fetch_prestations_by_ids(
    company_id: int, prestation_ids: List[int]
) -> List[CataloguePrestation]:
    """Lecture seule des prestations demandées, dans l'ordre des IDs fournis."""
    if not prestation_ids:
        return []

    query = """
        SELECT
            p.id,
            p.nom,
            p.unite,
            p."prixVenteMin"  AS prix_vente_min,
            p."prixVenteMax"  AS prix_vente_max,
            p.description,
            c.nom AS categorie_nom
        FROM prestations p
        LEFT JOIN categories_prestations c ON c.id = p."categorieId"
        WHERE p."companyId" = %s AND p.actif = true AND p.id = ANY(%s)
    """
    with _get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, (company_id, list(prestation_ids)))
            rows = cur.fetchall()

    by_id = {
        row["id"]: CataloguePrestation(
            id=row["id"],
            nom=row["nom"],
            unite=row["unite"],
            prix_vente_min=row["prix_vente_min"],
            prix_vente_max=row["prix_vente_max"],
            description=row["description"],
            categorie_nom=row["categorie_nom"],
            options=[],
        )
        for row in rows
    }
    options_by_prestation = _fetch_options_for_ids(list(by_id.keys()))
    ordered = []
    for prestation_id in prestation_ids:
        prestation = by_id.get(prestation_id)
        if prestation is None:
            continue
        prestation.options = options_by_prestation.get(prestation_id, [])
        ordered.append(prestation)
    return ordered


def _fetch_options_for_ids(prestation_ids: List[int]) -> dict:
    if not prestation_ids:
        return {}
    query = """
        SELECT op."prestationId" AS prestation_id,
               op.id AS option_id, op.nom AS option_nom,
               op.description AS option_description, co.id AS choix_id,
               co.nom AS choix_nom, co.description AS choix_description
        FROM options_prestations op
        LEFT JOIN choix_options co ON co."optionId" = op.id AND co.actif = true
        WHERE op."prestationId" = ANY(%s)
        ORDER BY op."prestationId", op.ordre, co.ordre
    """
    with _get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, (list(prestation_ids),))
            rows = cur.fetchall()

    grouped: dict = {prestation_id: [] for prestation_id in prestation_ids}
    options_by_id: dict = {}
    for row in rows:
        option = options_by_id.get(row["option_id"])
        if option is None:
            option = {
                "id": row["option_id"],
                "nom": row["option_nom"],
                "description": row["option_description"],
                "choix": [],
            }
            options_by_id[row["option_id"]] = option
            grouped.setdefault(row["prestation_id"], []).append(option)
        if row["choix_id"] is not None:
            option["choix"].append(
                {
                    "id": row["choix_id"],
                    "nom": row["choix_nom"],
                    "description": row["choix_description"],
                }
            )
    return grouped


def _fetch_options(prestation_id: int) -> List[dict]:
    """Arbre OptionPrestation -> ChoixOption léger destiné au contexte LLM.

    Les composants, coûts et règles de prix ne sont volontairement jamais
    transmis au modèle : ils sont relus en base seulement après sa sélection.
    """
    query = """
        SELECT op.id AS option_id, op.nom AS option_nom,
               op.description AS option_description, co.id AS choix_id,
               co.nom AS choix_nom, co.description AS choix_description
        FROM options_prestations op
        LEFT JOIN choix_options co ON co."optionId" = op.id AND co.actif = true
        WHERE op."prestationId" = %s
        ORDER BY op.ordre, co.ordre
    """
    with _get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(query, (prestation_id,))
            rows = cur.fetchall()

    options_by_id = {}
    for row in rows:
        option = options_by_id.setdefault(
            row["option_id"],
            {
                "id": row["option_id"],
                "nom": row["option_nom"],
                "description": row["option_description"],
                "choix": [],
            },
        )
        if row["choix_id"] is not None:
            option["choix"].append(
                {
                    "id": row["choix_id"],
                    "nom": row["choix_nom"],
                    "description": row["choix_description"],
                }
            )
    return list(options_by_id.values())
