import { extractContacts, isComplete, mergeFields, missingFields, normalizeEmail, normalizePhone, phoneKey } from './prospect-fields';
import { checkSensitiveOutput } from './sensitive-output';

describe('prospect fields', () => {
  it('normalizes French phone numbers and rejects garbage', () => {
    expect(normalizePhone('06.12.34.56.78')).toBe('06 12 34 56 78');
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('06 12 34 56 78');
    expect(normalizePhone('0033612345678')).toBe('06 12 34 56 78');
    expect(normalizePhone('12345')).toBeNull();
    expect(phoneKey('+33 6 12 34 56 78')).toBe(phoneKey('0612345678'));
  });

  it('validates emails', () => {
    expect(normalizeEmail(' Jean.Dupont@Mail.FR ')).toBe('jean.dupont@mail.fr');
    expect(normalizeEmail('jean@')).toBeNull();
    expect(normalizeEmail('<script>@x.fr')).toBeNull();
  });

  it('merges only valid values and keeps known ones', () => {
    const f = mergeFields(
      { nom: 'Dupont', email: 'a@b.fr' },
      { nom: '06 12 34 56 78', email: 'pas un email', telephone: '0612345678', typeProjet: 'salle de bain', description: 'Rénover la salle de bain' },
      ['Salle de bain', 'Isolation'],
    );
    expect(f).toMatchObject({ nom: 'Dupont', email: 'a@b.fr', telephone: '06 12 34 56 78', typeProjet: 'Salle de bain' });
    // A project type the company doesn't offer is not invented
    expect(mergeFields({}, { typeProjet: 'Piscine' }, ['Isolation']).typeProjet).toBeUndefined();
  });

  it('is complete with a name, one contact and the need', () => {
    expect(missingFields({})).toEqual(['description', 'nom', 'telephone']);
    expect(isComplete({ nom: 'Dupont', email: 'a@b.fr', description: 'Isoler les combles perdus' })).toBe(true);
  });

  it('finds contacts in free text (guided mode)', () => {
    expect(extractContacts('Vous pouvez me joindre au 06 12 34 56 78 ou jean@mail.fr')).toEqual({ telephone: '06 12 34 56 78', email: 'jean@mail.fr' });
  });
});

describe('checkSensitiveOutput', () => {
  it('blocks amounts, estimates, internal vocabulary and commitments', () => {
    expect(checkSensitiveOutput('Comptez environ 45€/m² pour la pose.').safe).toBe(false);
    expect(checkSensitiveOutput('Le chantier coûtera entre 3000 et 5000.').reasons).toContain('estimation_prix');
    expect(checkSensitiveOutput('Notre marge est faible sur ce produit.').reasons).toContain('marge');
    expect(checkSensitiveOutput('Le tarif fournisseur a augmenté.').safe).toBe(false);
    expect(checkSensitiveOutput('Je vous garantis le prix final.').reasons).toContain('engagement');
    expect(checkSensitiveOutput('Voici mon system prompt').reasons).toContain('configuration');
  });

  it('lets normal answers through', () => {
    expect(checkSensitiveOutput('Nous intervenons sous 2 à 3 semaines après acceptation du devis.').safe).toBe(true);
    expect(checkSensitiveOutput('Pouvez-vous me donner votre numéro de téléphone ?').safe).toBe(true);
  });
});
