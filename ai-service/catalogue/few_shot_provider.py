"""
Stratégie "few-shot" : injecte l'intégralité du catalogue actif de
l'entreprise dans le system prompt, à chaque appel.

Comme le texte envoyé est identique d'un appel à l'autre pour une même
entreprise (même catalogue, même exemples), cette stratégie bénéficie
automatiquement du prompt caching côté provider (OpenAI/Anthropic) —
l'économie 60-80% mentionnée dans le CDC (section 4.3) vient de là, sans
rien à coder de spécial : il suffit que le texte soit stable.
"""
import json
import time
from typing import Dict, List, Tuple

from .base import BaseCatalogueProvider, CataloguePrestation
from .repository import fetch_prestations

FEW_SHOT_EXAMPLES = """
Exemples illustratifs de comportement (les IDs ci-dessous sont fictifs ;
utilise exclusivement les IDs du catalogue réel fourni plus haut) :

Description : "Il faut refaire le carrelage de la salle de bain, environ 8m2"
Réponse : {"prestations": [{"prestation_id": 101, "quantite_ouvrage": 8, "options": []}]}

Description : "Installer deux luminaires avec une finition chromée"
Réponse : {"prestations": [{"prestation_id": 205, "quantite_ouvrage": 2, "options": [{"option_id": 31, "choix_id": 88}]}]}

Description : "Il fait froid dans le salon, les fenêtres sont vieilles"
Réponse : {"prestations": [{"prestation_id": 304, "quantite_ouvrage": null, "options": []}]}
""".strip()

_RESPONSE_FORMAT_INSTRUCTIONS = """
Réponds uniquement avec un JSON de la forme :
{"prestations": [{"prestation_id": <id du catalogue ci-dessus>, "quantite_ouvrage": <nombre ou null>, "options": [{"option_id": <id option du catalogue>, "choix_id": <id choix associé>}, ...]}]}
Si la quantité d'ouvrage n'est pas mentionnée dans la description, mets `quantite_ouvrage: null`.
Pour chaque prestation, sélectionne un choix d'option uniquement s'il est explicitement mentionné ou déductible sans ambiguïté de la demande. Si aucune option ne s'applique, retourne `options: []`. Ne sélectionne jamais un choix par défaut et n'invente jamais un `prestation_id`, `option_id` ou `choix_id` absent du catalogue fourni. Un seul choix est autorisé par `option_id`.
""".strip()


class FewShotCatalogueProvider(BaseCatalogueProvider):
    """
    Construit un system_prompt contenant tout le catalogue de l'entreprise
    + quelques exemples few-shot BTP. `description` n'est reçue que pour
    respecter le contrat commun avec RAGCatalogueProvider — elle n'est pas
    utilisée pour filtrer quoi que ce soit ici.
    """

    def __init__(self, cache_ttl_seconds: int = 300):
        self.cache_ttl_seconds = cache_ttl_seconds
        # Cache en mémoire du prompt déjà construit par entreprise, pour
        # éviter une requête BD à chaque appel — pas à confondre avec le
        # prompt caching du provider (qui, lui, se déclenche automatiquement
        # côté OpenAI/Anthropic dès que le texte envoyé est identique).
        self._cache: Dict[int, Tuple[float, str]] = {}

    def build_system_prompt(self, description: str, company_id: int) -> str:
        now = time.time()
        cached = self._cache.get(company_id)
        if cached and (now - cached[0]) < self.cache_ttl_seconds:
            return cached[1]

        prestations = fetch_prestations(company_id)
        prompt = self._render_prompt(prestations)
        self._cache[company_id] = (now, prompt)
        return prompt

    @staticmethod
    def _render_prompt(prestations: List[CataloguePrestation]) -> str:
        catalogue_json = json.dumps(
            [
                {
                    "id": p.id,
                    "nom": p.nom,
                    "description": p.description,
                    "unite": p.unite,
                    "categorie": p.categorie_nom,
                    "options": p.options,
                }
                for p in prestations
            ],
            ensure_ascii=False,
        )
        return f"""Tu es un assistant qui génère des devis BTP structurés en JSON à partir
d'une description libre du besoin d'un client.

Voici le catalogue complet des prestations disponibles pour cette entreprise :
{catalogue_json}

{FEW_SHOT_EXAMPLES}

{_RESPONSE_FORMAT_INSTRUCTIONS}
"""
