export interface SampleText {
  id: string;
  titre: string;
  badge: string;
  texte: string;
  surfaceSuggeree?: number;
}

export const SAMPLE_TEXTS: SampleText[] = [
  {
    id: 'sdb_complete',
    titre: 'Rénovation complète Salle de bain 9 m²',
    badge: 'Salle de bain',
    texte: 'Rénovation totale d\'une salle de bain de 9m2. Dépose de l\'ancien carrelage, ragréage fibré du sol, pose d\'un carrelage grès cérame 60x60 avec plinthes assorties. Remplacement de la douche par un receveur extra-plat 120x80 avec paroi vitrée securit et mise en peinture hydrofuge des murs et plafonds.',
    surfaceSuggeree: 9,
  },
  {
    id: 'piece_vie',
    titre: 'Séjour & Salon 35 m² — Peinture & Cloisons',
    badge: 'Pièce de vie',
    texte: 'Chantier de rafraîchissement d\'un salon de 35 m². Création d\'une cloison séparative phonique de 18 m² en Placostil 72/48 avec bloc-porte intégré. Mise en peinture complète 2 couches velours des murs et plafonds après préparation des supports.',
    surfaceSuggeree: 35,
  },
  {
    id: 'carrelage_terrasse',
    titre: 'Pose de carrelage 25 m² sans métré initial',
    badge: 'Carrelage',
    texte: 'Pose de carrelage au sol 60x60 sur chape existante avec plinthes périphériques et joints hydrofuges. Prévoir système d\'étanchéité sous carrelage.',
    surfaceSuggeree: 25,
  },
];

export interface SamplePhoto {
  id: string;
  titre: string;
  description: string;
  imagePath: string;
  piece: string;
  surfaceEstimee: number;
  surfaceConfidence: number;
  materiaux: string[];
  etatDesLieux: string;
  travauxSuggere: string[];
}

export const SAMPLE_PHOTOS: SamplePhoto[] = [
  {
    id: 'photo_sdb_1',
    titre: 'Salle de bain à rénover',
    description: 'Chantier pavillon 1985 — Plomberie apparente et carrelage ancien',
    imagePath: '/src/assets/images/chantier_sdb_1790286860947.jpg',
    piece: 'Salle de bain principale',
    surfaceEstimee: 8.8,
    surfaceConfidence: 0.85,
    materiaux: [
      'Carrelage grès cérame 60x60',
      'Faïence murale 30x60',
      'Receveur extra-plat résine',
      'Placo hydrofuge BA13',
    ],
    etatDesLieux: 'Supports sains mais revêtement ébréché. Étanchéité douche à reprendre entièrement.',
    travauxSuggere: [
      'Pose de carrelage au sol grès cérame 60x60 cm',
      'Fourniture et pose de receveur de douche extra-plat & faïence',
      'Mise en peinture murs et plafonds (Impression + 2 couches velours)',
    ],
  },
  {
    id: 'photo_salon_2',
    titre: 'Pièce de vie / Salon avec mur brut',
    description: 'Cloisons à monter et peinture générale',
    imagePath: '/src/assets/images/chantier_sdb_1790286860947.jpg',
    piece: 'Salon / Séjour',
    surfaceEstimee: 24.0,
    surfaceConfidence: 0.65, // < 0.7 déclenche l'avertissement de confiance de surface !
    materiaux: [
      'Placo phonique BA13',
      'Peinture velours dépolluante',
      'Laine acoustique 45mm',
      'Bloc-porte bois',
    ],
    etatDesLieux: 'Grand volume brut nécessitant cloisonnement et finitions peinture.',
    travauxSuggere: [
      'Création de cloison distributive Placostil 72/48 acoustique',
      'Mise en peinture murs et plafonds (Impression + 2 couches velours)',
    ],
  },
];

export interface SampleVoice {
  id: string;
  titre: string;
  artisan: string;
  duree: string;
  transcript: string;
  confidence: number;
}

export const SAMPLE_VOICES: SampleVoice[] = [
  {
    id: 'voice_1',
    titre: 'Visite chantier M. Dupont — SDB 9m²',
    artisan: 'Marc L. (Conducteur de travaux)',
    duree: '00:26',
    transcript: 'Sur le chantier de monsieur Dupont, il faut prévoir la dépose complète de la vieille faïence et du carrelage au sol sur 9 mètres carrés. On met un nouveau carrelage 60 par 60 avec les plinthes qui vont avec. Pour la douche, on installe un receveur extra-plat de 120 par 80 et une paroi vitrée securit, plus une peinture spéciale pièces humides au plafond.',
    confidence: 0.94, // Vert (> 0.85)
  },
  {
    id: 'voice_2',
    titre: 'Mémo rapide — Cloison & Peinture',
    artisan: 'Jean-Christophe (Chargé d\'affaires)',
    duree: '00:19',
    transcript: 'Ici dans le salon il y a une cloison acoustique de 18 mètres carrés à monter en placo phonique avec un bloc-porte. Et ensuite deux passes de peinture velours blanc cassé sur tous les murs.',
    confidence: 0.78, // Orange (0.70 - 0.85)
  },
  {
    id: 'voice_3',
    titre: 'Enregistrement audio bruité — Carrelage',
    artisan: 'Enregistrement direct chantier',
    duree: '00:14',
    transcript: 'Ragréage fibré sol et carrelage salon environ... surface à confirmer sur place avec client, colle C2S1.',
    confidence: 0.62, // Rouge (< 0.70)
  },
];
