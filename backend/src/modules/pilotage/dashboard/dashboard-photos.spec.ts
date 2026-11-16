import { chantiersSansPhoto } from './chantiers-sans-photo';

describe('Tableau de bord — chantiers sans photo (26/10)', () => {
  it('lists job sites without a photo for 2 days, never-photographed first', () => {
    const now = new Date('2026-10-26T12:00:00Z');
    const client = { nom: 'Dupont', prenom: null };
    const r = chantiersSansPhoto(
      [
        {
          id: 1,
          reference: 'A',
          client,
          photosAvancement: [{ createdAt: new Date('2026-10-26T08:00:00Z') }],
        },
        {
          id: 2,
          reference: 'B',
          client,
          photosAvancement: [{ createdAt: new Date('2026-10-20T08:00:00Z') }],
        },
        { id: 3, reference: 'C', client, photosAvancement: [] },
      ],
      now,
    );
    expect(r.nombre).toBe(2);
    expect(r.liste.map((c) => c.id)).toEqual([3, 2]);
  });
});
