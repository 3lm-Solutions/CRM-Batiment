import { Prisma } from '../../generated/prisma/client';
import { amountsFor, costsFor, stripCosts } from './hide-costs';

describe('hide-costs (chef de chantier sees no amount in the catalogue / stock)', () => {
  const row = {
    id: 1,
    nom: 'Ciment',
    prixAchatFixe: new Prisma.Decimal('8.50'),
    stockActuel: new Prisma.Decimal('12'),
    fournisseur: { id: 2, nom: 'BigMat' },
    compositions: [
      {
        materiau: { id: 1, prixAchatFixe: 3 },
        serviceMainOeuvre: { id: 4, prixUnitaire: 40, coutJournalier: 300 },
      },
    ],
  };

  it('removes every cost key, deeply, and keeps the rest', () => {
    const out = stripCosts({ data: [row], meta: { total: 1 } });
    expect(out.data[0]).not.toHaveProperty('prixAchatFixe');
    expect(out.data[0].compositions[0].materiau).toEqual({ id: 1 });
    expect(out.data[0].compositions[0].serviceMainOeuvre).toEqual({ id: 4 });
    expect(out.data[0].stockActuel.toString()).toBe('12');
    expect(out.meta).toEqual({ total: 1 });
  });

  it('orders and sous-traitants: no amount at all for the chef (B2)', async () => {
    const commande = {
      id: 1,
      totalHT: 455.6,
      lignes: [{ materiauNom: 'Peinture', quantite: 10, prixUnitaire: 45, totalHT: 450 }],
    };
    expect(await amountsFor({ role: 'CHEF_CHANTIER' }, commande)).toEqual({
      id: 1,
      lignes: [{ materiauNom: 'Peinture', quantite: 10 }],
    });
    const st = {
      id: 2,
      nom: 'Bernard',
      contrats: [{ id: 3, montantHT: 5000 }],
      paiements: [{ id: 4, montantHT: 100 }],
    };
    expect(await amountsFor({ role: 'CHEF_CHANTIER' }, st)).toEqual({
      id: 2,
      nom: 'Bernard',
      contrats: [{ id: 3 }],
    });
    expect(await amountsFor({ role: 'ASSISTANTE' }, st)).toBe(st);
  });

  it('applies to the chef only', async () => {
    expect(await costsFor({ role: 'ADMIN' }, row)).toBe(row);
    expect(await costsFor({ role: 'CHEF_CHANTIER' }, Promise.resolve(row))).not.toHaveProperty(
      'prixAchatFixe',
    );
  });
});
