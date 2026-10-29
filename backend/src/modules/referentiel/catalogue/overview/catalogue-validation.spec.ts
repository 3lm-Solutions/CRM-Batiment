import { validateCatalogue, ValidationPrestation } from './catalogue-validation';

const prestation = (o: Partial<ValidationPrestation> = {}): ValidationPrestation => ({
  id: 1,
  nom: 'Chape',
  prixVenteMin: 30,
  prixVenteMax: 50,
  compositions: [{ materiauId: 1, serviceMainOeuvreId: null, quantiteParUnite: 1 }],
  options: [],
  ...o,
});

describe('validateCatalogue', () => {
  it('accepts a healthy catalogue', () => {
    expect(validateCatalogue(1, [prestation()]).isValid).toBe(true);
  });

  it('flags an empty catalogue', () => {
    const r = validateCatalogue(0, []);
    expect(r.errors.map((e) => e.type)).toEqual(['CATEGORIES_VIDES', 'PRESTATIONS_VIDES']);
  });

  it('flags an inverted price range', () => {
    expect(validateCatalogue(1, [prestation({ prixVenteMin: 60 })]).errors[0].type).toBe(
      'FOURCHETTE_INVALIDE',
    );
  });

  it('warns (not errors) when a prestation has no composition', () => {
    const r = validateCatalogue(1, [prestation({ compositions: [] })]);
    expect(r.isValid).toBe(true);
    expect(r.warnings[0].type).toBe('SANS_COMPOSITION');
  });

  it('does not warn when only choice compositions exist', () => {
    const r = validateCatalogue(1, [
      prestation({
        compositions: [],
        options: [
          { id: 1, nom: 'Type', obligatoire: true, choix: [{ id: 1, aComposition: true }] },
        ],
      }),
    ]);
    expect(r.warnings).toEqual([]);
  });

  it('flags two options competing with their own compositions', () => {
    const opt = (id: number) => ({
      id,
      nom: `O${id}`,
      obligatoire: false,
      choix: [{ id, aComposition: true }],
    });
    const r = validateCatalogue(1, [prestation({ options: [opt(1), opt(2)] })]);
    expect(r.errors[0].type).toBe('COMPOSITIONS_CONCURRENTES');
  });

  it('a required option without choices is an error, an optional one a warning', () => {
    const r = validateCatalogue(1, [
      prestation({
        options: [
          { id: 1, nom: 'A', obligatoire: true, choix: [] },
          { id: 2, nom: 'B', obligatoire: false, choix: [] },
        ],
      }),
    ]);
    expect(r.errors.map((e) => e.type)).toEqual(['OPTION_OBLIGATOIRE_SANS_CHOIX']);
    expect(r.warnings.map((e) => e.type)).toEqual(['OPTION_SANS_CHOIX']);
  });
});
