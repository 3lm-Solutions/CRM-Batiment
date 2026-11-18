import { alertesInstallation, ETAPES, etapeSuivante, MISSIONS_FILTRE } from './installation-rules';

const J = (iso: string) => new Date(`${iso}T08:00:00.000Z`);

describe('installation rules', () => {
  it('has the 8 steps in order', () => {
    expect(ETAPES).toEqual([
      'DEVIS_SIGNE',
      'INSTALLATEUR_PROPOSE',
      'MISSION_ACCEPTEE',
      'LIVRAISON',
      'POSE',
      'FINITIONS',
      'TERMINEE',
      'CLOTUREE',
    ]);
  });

  it('the installer moves LIVRAISON → POSE → FINITIONS only', () => {
    expect(etapeSuivante('LIVRAISON')).toBe('POSE');
    expect(etapeSuivante('POSE')).toBe('FINITIONS');
    expect(etapeSuivante('FINITIONS')).toBeNull(); // the signed PV ends it
    expect(etapeSuivante('MISSION_ACCEPTEE')).toBeNull();
  });

  it('late when the confirmed date is past and the work not finished', () => {
    const now = J('2026-11-20');
    expect(
      alertesInstallation(
        { etape: 'POSE', dateConfirmee: J('2026-11-18'), dateSouhaitee: null },
        [],
        now,
      ).enRetard,
    ).toBe(true);
    expect(
      alertesInstallation(
        { etape: 'TERMINEE', dateConfirmee: J('2026-11-18'), dateSouhaitee: null },
        [],
        now,
      ).enRetard,
    ).toBe(false);
    expect(
      alertesInstallation(
        { etape: 'POSE', dateConfirmee: J('2026-11-25'), dateSouhaitee: null },
        [],
        now,
      ).enRetard,
    ).toBe(false);
  });

  it('delivery alert: an order not received that arrives after the installation date (or has no date)', () => {
    const now = J('2026-11-10');
    const inst = {
      etape: 'LIVRAISON' as const,
      dateConfirmee: J('2026-11-20'),
      dateSouhaitee: null,
    };
    expect(
      alertesInstallation(
        inst,
        [{ statutLivraison: 'ENVOYEE', dateLivraisonPrevue: J('2026-11-22') }],
        now,
      ).alerteLivraison,
    ).toBe(true);
    expect(
      alertesInstallation(inst, [{ statutLivraison: 'ENVOYEE', dateLivraisonPrevue: null }], now)
        .alerteLivraison,
    ).toBe(true);
    expect(
      alertesInstallation(
        inst,
        [{ statutLivraison: 'ENVOYEE', dateLivraisonPrevue: J('2026-11-18') }],
        now,
      ).alerteLivraison,
    ).toBe(false);
    expect(
      alertesInstallation(
        inst,
        [{ statutLivraison: 'RECUE', dateLivraisonPrevue: J('2026-11-22') }],
        now,
      ).alerteLivraison,
    ).toBe(false);
    // once the pose has started, the delivery no longer delays it
    expect(
      alertesInstallation(
        { ...inst, etape: 'POSE' },
        [{ statutLivraison: 'ENVOYEE', dateLivraisonPrevue: null }],
        now,
      ).alerteLivraison,
    ).toBe(false);
  });

  it('mission filters of the installer', () => {
    expect(MISSIONS_FILTRE.PROPOSEES).toEqual(['INSTALLATEUR_PROPOSE']);
    expect(MISSIONS_FILTRE.EN_COURS).toEqual([
      'MISSION_ACCEPTEE',
      'LIVRAISON',
      'POSE',
      'FINITIONS',
    ]);
    expect(MISSIONS_FILTRE.TERMINEES).toEqual(['TERMINEE', 'CLOTUREE']);
  });
});
