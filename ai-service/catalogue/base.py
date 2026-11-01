"""
Interface unifiée pour fournir le contexte catalogue au LLM, quelle que soit
la stratégie retenue (few-shot ou RAG). Permet de basculer entre les deux
sans toucher au code métier ni au ToolRegistry — seul le system_prompt injecté
dans generate_devis_from_text() change de contenu, jamais sa forme.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CataloguePrestation:
    """Une prestation du catalogue, reflet du modèle Prisma `Prestation`."""
    id: int
    nom: str
    unite: str
    prix_vente_min: float
    prix_vente_max: float
    description: Optional[str] = None
    categorie_nom: Optional[str] = None
    # Structure légère envoyée au LLM, sans aucun prix ni composition métier :
    # [{"id", "nom", "description", "choix": [{"id", "nom", "description"}]}]
    options: list = field(default_factory=list)


class BaseCatalogueProvider(ABC):
    """
    Contrat unique : à partir d'une description libre et d'une entreprise,
    construire le system_prompt à injecter dans
    ToolRegistry.generate_devis_from_text().

    - FewShotCatalogueProvider : ignore le contenu de `description` pour la
      recherche, retourne tout le catalogue de l'entreprise.
    - RAGCatalogueProvider : utilise `description` (mistral-embed) pour ne
      récupérer que les prestations au-dessus du seuil de similarité.
    """

    @abstractmethod
    def build_system_prompt(self, description: str, company_id: int) -> str:
        raise NotImplementedError
