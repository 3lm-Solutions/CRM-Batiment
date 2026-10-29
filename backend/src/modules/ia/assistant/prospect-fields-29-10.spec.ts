import { champDemande, champsRenseignes, deduireChamps } from './prospect-fields';

/** 29/10: the visitor's details are kept even when the AI forgets them. */
describe('chatbot — details from the visitor’s own words (29/10)', () => {
  it('knows which detail was asked', () => {
    expect(champDemande('À quel nom dois-je enregistrer votre demande ?')).toBe('nom');
    expect(champDemande('Quel est le meilleur numéro pour vous recontacter ?')).toBe('telephone');
    expect(champDemande('Dans quelle ville se situe le chantier ?')).toBe('adresse');
    expect(champDemande('Pouvez-vous me décrire votre projet ?')).toBe('description');
    expect(champDemande(null)).toBeNull();
  });

  it('contacts anywhere, « je m’appelle » stops at the rest of the sentence', () => {
    expect(
      deduireChamps(
        'Je m’appelle Jean Dupont et je voudrais refaire ma cuisine, 06 12 34 56 78',
        null,
        {},
      ),
    ).toMatchObject({
      prenom: 'Jean',
      nom: 'Dupont',
      telephone: '06 12 34 56 78',
    });
    expect(deduireChamps('mon mail : jean.d@mail.fr', 'telephone', {})).toEqual({
      email: 'jean.d@mail.fr',
    });
  });

  it('a short answer to the question asked', () => {
    expect(deduireChamps('Rayen Gara', 'nom', {})).toEqual({ prenom: 'Rayen', nom: 'Gara' });
    expect(deduireChamps('Dupont', 'nom', {})).toEqual({ nom: 'Dupont' });
    expect(deduireChamps('Lyon 3e', 'adresse', {})).toEqual({ adresse: 'Lyon 3e' });
    expect(
      deduireChamps('Refaire la salle de bain de 8 m² avec une douche', 'description', {}),
    ).toEqual({
      description: 'Refaire la salle de bain de 8 m² avec une douche',
    });
    // a question is never taken as a detail
    expect(deduireChamps('Combien coûte une salle de bain ?', 'description', {})).toEqual({});
    // the name already known is not replaced by a random answer
    expect(deduireChamps('Martin', 'nom', { nom: 'Dupont' })).toEqual({});
  });

  it('empty AI values do not erase what was found', () => {
    expect(
      champsRenseignes({ nom: '', email: 'a@b.fr', telephone: '  ', description: 'x' }),
    ).toEqual({ email: 'a@b.fr', description: 'x' });
  });
});
