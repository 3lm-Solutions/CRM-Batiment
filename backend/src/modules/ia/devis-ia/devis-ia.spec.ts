import {
  type CatalogueEntry,
  extractLength,
  extractSurface,
  guessQuantity,
  keywords,
  sameWord,
  scoreCatalogue,
} from './catalogue-match';
import {
  buildPhotoMessages,
  MAX_LIGNES,
  parseAnalysePhoto,
  parseProposition,
  PHOTO_SCHEMA,
} from './devis-ia.prompt';

const entry = (
  id: number,
  nom: string,
  unite: string,
  categorie: string,
  sousCategorie: string | null = null,
): CatalogueEntry => ({
  id,
  nom,
  unite,
  categorie,
  sousCategorie,
  description: null,
});

const CATALOGUE = [
  entry(1, 'Dépose sanitaires', 'PIECE', 'Démolition'),
  entry(2, 'Installation douche complète', 'FORFAIT', 'Plomberie'),
  entry(3, 'Pose carrelage sol', 'M2', 'Revêtements', 'Carrelage'),
  entry(4, 'Pose faïence', 'M2', 'Revêtements', 'Carrelage'),
  entry(5, 'Peinture plafond', 'M2', 'Peinture'),
  entry(6, 'Pose clôture', 'ML', 'Extérieur'),
];

describe('Devis IA — correspondance avec le catalogue', () => {
  it('normalises words: accents, plurals, stop words', () => {
    expect(keywords('Refaire les CARREAUX de la Douche à l’italienne')).toEqual([
      'carrelage',
      'douche',
      'italienne',
    ]);
  });

  it('matches word families by prefix', () => {
    expect(sameWord('carreau', 'carrelage')).toBe(true);
    expect(sameWord('isol', 'isolation')).toBe(true);
    expect(sameWord('douche', 'peinture')).toBe(false);
  });

  it('ranks prestations by name, then category', () => {
    const scored = scoreCatalogue(
      'Salle de bain : douche italienne, carrelage au sol et faïence',
      CATALOGUE,
    );
    const ids = scored.map((s) => s.id);
    expect([...ids.slice(0, 3)].sort()).toEqual([2, 3, 4]);
    expect(ids.includes(6)).toBe(false);
    expect(scoreCatalogue('bonjour', CATALOGUE)).toEqual([]);
  });

  it('reads surfaces and lengths written in many ways', () => {
    expect(extractSurface('salle de bain de 8 m²')).toBe(8);
    expect(extractSurface('environ 12,5m2 de sol')).toBe(12.5);
    expect(extractSurface('30 mètres carrés')).toBe(30);
    expect(extractSurface('pas de surface')).toBeNull();
    expect(extractLength('clôture de 25 ml')).toBe(25);
    expect(extractLength('40 mètres linéaires')).toBe(40);
    expect(guessQuantity('M2', 8, null)).toBe(8);
    expect(guessQuantity('ML', 8, null)).toBe(1);
    expect(guessQuantity('FORFAIT', 8, 4)).toBe(1);
  });
});

describe('Devis IA — validation de la réponse du modèle', () => {
  const allowed = new Set([1, 2, 3]);

  it('drops invented ids, duplicates and absurd quantities', () => {
    const parsed = parseProposition(
      {
        lignes: [
          { prestationId: 3, quantite: 8, justification: '8 m² de sol' },
          { prestationId: 999, quantite: 1, justification: 'inventée' },
          { prestationId: 3, quantite: 2, justification: 'doublon' },
          { prestationId: 2, quantite: -1, justification: 'négative' },
          { prestationId: 1, quantite: 1e9, justification: 'énorme' },
        ],
        nonCouverts: ['Pose miroir', 42],
        hypotheses: ['Hauteur 2,50 m'],
      },
      allowed,
    );
    expect(parsed).toEqual({
      lignes: [
        { prestationId: 3, quantite: 8, justification: '8 m² de sol' },
        { prestationId: 1, quantite: 10_000, justification: 'énorme' },
      ],
      nonCouverts: ['Pose miroir'],
      hypotheses: ['Hauteur 2,50 m'],
    });
  });

  it('rejects a malformed answer and caps the number of lines', () => {
    expect(parseProposition('texte', allowed)).toBeNull();
    expect(parseProposition({ lignes: 'non' }, allowed)).toBeNull();
    const many = new Set(Array.from({ length: 30 }, (_, i) => i + 1));
    const parsed = parseProposition(
      { lignes: [...many].map((id) => ({ prestationId: id, quantite: 1, justification: '' })) },
      many,
    );
    expect(parsed!.lignes).toHaveLength(MAX_LIGNES);
  });
});

describe('Devis IA — photos (C37 du 21/10)', () => {
  it('sends the photos with the user message and the catalogue in the text', () => {
    const msgs = buildPhotoMessages(['data:image/jpeg;base64,AAAA'], '', CATALOGUE);
    expect(msgs[0].role).toBe('system');
    expect(msgs[1].images).toEqual(['data:image/jpeg;base64,AAAA']);
    expect(msgs[1].content).toContain('3 | Pose carrelage sol | M2');
    expect(msgs[1].content).toContain('aucune');
  });

  it('requires every field of the analysis (strict JSON schema)', () => {
    const s = PHOTO_SCHEMA.schema as {
      required: string[];
      properties: { analyse: { required: string[]; properties: Record<string, unknown> } };
    };
    expect(s.required).toEqual(['analyse', 'lignes', 'nonCouverts', 'hypotheses']);
    expect(s.properties.analyse.required.sort()).toEqual(
      Object.keys(s.properties.analyse.properties).sort(),
    );
  });

  it('reads the analysis, rounding the surface and distrusting odd values', () => {
    const a = parseAnalysePhoto({
      analyse: {
        piece: ' Salle de bain ',
        surfaceEstimeeM2: 6.04,
        objetReference: true,
        elementsVisibles: ['baignoire', '', 'faïence'],
        etat: 'joints noircis',
        qualitePhoto: 'BONNE',
      },
    });
    expect(a).toEqual({
      piece: 'Salle de bain',
      surfaceEstimeeM2: 6,
      objetReference: true,
      elementsVisibles: ['baignoire', 'faïence'],
      etat: 'joints noircis',
      qualitePhoto: 'BONNE',
    });

    const bad = parseAnalysePhoto({ analyse: { surfaceEstimeeM2: -3, qualitePhoto: 'SUPER' } });
    expect(bad).toMatchObject({
      piece: 'Non identifiée',
      surfaceEstimeeM2: null,
      objetReference: false,
      qualitePhoto: 'MOYENNE',
    });
    expect(parseAnalysePhoto(null).surfaceEstimeeM2).toBeNull();
    expect(parseAnalysePhoto({ analyse: { surfaceEstimeeM2: null } }).surfaceEstimeeM2).toBeNull();
  });
});
