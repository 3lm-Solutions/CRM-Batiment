"""
Structures de données du pipeline texte. Ces objets vivent en mémoire
(session de validation humaine) — voir décision prise dans la conversation :
aucun regroupement par occurrence n'est persisté en base, le devis final
n'affiche que des lignes plates dans LigneDevis.
"""
import uuid
from dataclasses import dataclass, field
from typing import List, Optional


@dataclass
class ComposantCalcule:
    """Un composant (matériau ou service de main d'œuvre) d'une occurrence de
    prestation, avec son prix de vente calculé une fois le taux de marge appliqué."""

    type: str  # "materiau" | "service_main_oeuvre"
    id: int  # materiauId ou serviceMainOeuvreId selon le type
    nom: str
    unite: str
    quantite_par_unite: float  # PrestationComposition.quantiteParUnite ou ChoixOptionComposition.quantiteParUnite
    cout_unitaire: float  # prixAchatFixe (matériau) ou prixUnitaire (service)

    # Remplis par pricing.appliquer_taux_marge() une fois la quantité d'ouvrage connue
    quantite_calculee: Optional[float] = None
    prix_vente_unitaire: Optional[float] = None
    total_ht: Optional[float] = None
    cout_total: Optional[float] = None


@dataclass
class OccurrencePrestation:
    """
    Une occurrence détectée d'une prestation dans la description. Si la même
    prestation catalogue est mentionnée deux fois (ex: "peindre le salon" et
    "peindre la chambre"), ce sont deux OccurrencePrestation distinctes, avec
    chacune sa propre quantité d'ouvrage et ses propres composants — c'est ce
    qui permet à l'interface de validation d'afficher deux blocs séparés.
    """

    prestation_id: int
    nom: str
    unite: str
    prix_vente_min: float
    prix_vente_max: float
    quantite_ouvrage: Optional[float]  # None si absente de la description -> bloquant
    uid: str = field(default_factory=lambda: str(uuid.uuid4()))
    composants: List[ComposantCalcule] = field(default_factory=list)
    options_choisies: List[str] = field(default_factory=list)
    choix_option_ids: List[int] = field(default_factory=list)
    options_disponibles: List[str] = field(default_factory=list)
    # Saisi à la main uniquement si le catalogue n'a aucune composition.
    cout_unitaire_manuel: Optional[float] = None

    # Remplis par pricing.py
    prix_vente_total: Optional[float] = None
    alerte_fourchette: Optional[dict] = None


@dataclass
class DevisEnConstruction:
    """
    Structure temporaire représentant l'état du devis pendant la session de
    validation humaine (étapes 2 à 8 du flux). N'est jamais sérialisée telle
    quelle en base — seule sa version aplatie (voir pipeline.valider_et_sauvegarder)
    est écrite dans LigneDevis.
    """

    devis_id: int
    company_id: int
    client_id: int
    createur_id: Optional[int] = None
    occurrences: List[OccurrencePrestation] = field(default_factory=list)
    taux_marge: Optional[float] = None
    tva_pourcent: float = 20.0
    # Montant HT positif saisi par le commercial. Il devient une ligne
    # négative « Remise commerciale » dans LigneDevis et les exports.
    remise_ht: float = 0.0
    remise_libelle: str = "Remise commerciale"
