import {
  corpsUtile,
  estAdresseInterne,
  motsObjet,
  objetCorrespond,
  ressembleDemande,
  sujetPropre,
} from './email-rules';

describe('Prospects par email — règles', () => {
  it('keeps the new text, drops the quoted reply and the signature', () => {
    const texte = [
      'Bonjour,',
      'Je voudrais un devis pour refaire ma salle de bain (6 m²).',
      '--',
      'Jean Dupont',
      '',
      'Le lun. 20 oct. 2026 à 10:00, Bâtiment Pro <c@bp.fr> a écrit :',
      '> Merci pour votre message',
    ].join('\n');
    expect(corpsUtile(texte)).toBe(
      'Bonjour,\nJe voudrais un devis pour refaire ma salle de bain (6 m²).',
    );
    expect(corpsUtile('Ligne\n> citée\nSuite')).toBe('Ligne\nSuite');
  });

  it('recognises a work request without AI', () => {
    expect(ressembleDemande('Demande de devis', '')).toBe(true);
    expect(ressembleDemande('Bonjour', 'Fuite sous l’évier, pouvez-vous passer ?')).toBe(true);
    expect(ressembleDemande('Votre facture EDF', 'Votre facture du mois est disponible')).toBe(
      false,
    );
  });

  it('ignores our own addresses and cleans the subject', () => {
    expect(estAdresseInterne('Devis@bp.fr', ['devis@bp.fr', null])).toBe(true);
    expect(estAdresseInterne('client@x.fr', ['devis@bp.fr'])).toBe(false);
    expect(sujetPropre('RE: Fwd: Tr: Devis cuisine')).toBe('Devis cuisine');
  });

  it('filters on the subject words of IMAP_SUBJECTS (case and accents ignored)', () => {
    const mots = motsObjet(' devis, Demande ,,devis ');
    expect(mots).toEqual(['devis', 'demande']);
    expect(objetCorrespond('Re: DEMANDE de prix', mots)).toBe(true);
    expect(objetCorrespond('Votre DÉVIS cuisine', mots)).toBe(true);
    expect(objetCorrespond('Facture EDF', mots)).toBe(false);
    expect(objetCorrespond('Facture EDF', motsObjet(''))).toBe(true);
    expect(motsObjet(undefined)).toEqual([]);
  });
});
