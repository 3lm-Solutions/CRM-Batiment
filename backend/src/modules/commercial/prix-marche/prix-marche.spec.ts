import {
  celluleCsv,
  decoderTexte,
  lireCsv,
  lirePrix,
  lireUnite,
  normaliserNom,
} from './prix-marche.csv';
import {
  debutPeriode,
  positionPrix,
  prixMarche,
  quantile,
  statistiques,
} from './prix-marche.rules';

const d = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('prix de marché — statistiques (29/10)', () => {
  it('median and usual range (25–75 %) from the company prices', () => {
    const s = statistiques(
      [50, 60, 55, 70, 65].map((prix, i) => ({ prix, date: d(`2026-0${i + 1}-10`) })),
      d('2026-10-29'),
    )!;
    expect(s).toMatchObject({
      nombre: 5,
      min: 50,
      max: 70,
      mediane: 60,
      basse: 55,
      haute: 65,
      dernierPrix: 65,
    });
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });

  it('few prices: the range is min–max, and no trend', () => {
    const s = statistiques([
      { prix: 40, date: d('2026-09-01') },
      { prix: 48, date: d('2026-09-20') },
      { prix: 44, date: d('2026-10-01') },
    ])!;
    expect(s).toMatchObject({ basse: 40, haute: 48, tendancePctAn: null, estimeAujourdhui: null });
  });

  it('trend: a steady rise is projected to today and in 6 months', () => {
    // +1 €/month from 50 € → about +22 %/year on a 55 € average
    const obs = Array.from({ length: 10 }, (_, i) => ({
      prix: 50 + i,
      date: new Date(Date.UTC(2026, i, 1)),
    }));
    const s = statistiques(obs, new Date(Date.UTC(2026, 9, 1)))!;
    expect(s.tendancePctAn).toBeGreaterThan(18);
    expect(s.tendancePctAn).toBeLessThan(25);
    expect(s.estimeAujourdhui).toBeCloseTo(59, 0);
    expect(s.estime6Mois!).toBeGreaterThan(s.estimeAujourdhui!);
  });

  it('own data first, then the imported list, then nothing', () => {
    const bareme = { prixMin: 40, prixMax: 60, source: 'FFB' };
    const peu = statistiques([{ prix: 52, date: d('2026-10-01') }]);
    expect(prixMarche(peu, 'DEVIS', bareme)).toMatchObject({
      source: 'BAREME',
      basse: 40,
      haute: 60,
      nombre: 1,
    });
    expect(prixMarche(peu, 'DEVIS', null)).toBeNull();
    const assez = statistiques([50, 52, 54].map((prix) => ({ prix, date: d('2026-10-01') })));
    expect(prixMarche(assez, 'DEVIS', bareme)).toMatchObject({
      source: 'DEVIS',
      basse: 50,
      haute: 54,
      bareme,
    });
  });

  it('position of a price in the range', () => {
    expect(positionPrix(39, { basse: 40, haute: 60 })).toBe('BAS');
    expect(positionPrix(60, { basse: 40, haute: 60 })).toBe('DANS');
    expect(positionPrix(61, { basse: 40, haute: 60 })).toBe('HAUT');
    expect(debutPeriode(12, d('2026-10-29')).toISOString().slice(0, 7)).toBe('2025-10');
  });
});

describe('prix de marché — import CSV (29/10)', () => {
  it('reads an Excel FR file: « ; », decimal comma, accents, units in words', () => {
    const csv =
      'Type;Nom;Unité;Prix_min;Prix_max;Achat_vente;Source\nPRESTATION;Pose carrelage sol;m²;45;65,50;VENTE;FFB 2026\nmateriau;"Colle ""C2"" 25 kg";pièce;12;18;achat;\n';
    const r = lireCsv(csv);
    expect(r.erreurs).toEqual([]);
    expect(r.lignes).toEqual([
      {
        numero: 2,
        type: 'PRESTATION',
        nom: 'Pose carrelage sol',
        unite: 'M2',
        prixMin: 45,
        prixMax: 65.5,
        typePrix: 'VENTE',
        source: 'FFB 2026',
      },
      {
        numero: 3,
        type: 'MATERIAU',
        nom: 'Colle "C2" 25 kg',
        unite: 'PIECE',
        prixMin: 12,
        prixMax: 18,
        typePrix: 'ACHAT',
        source: null,
      },
    ]);
  });

  it('reports each wrong line with its number; blank template lines are skipped', () => {
    const csv = [
      'type,nom,unite,prix_min,prix_max',
      'PRESTATION,Peinture,m2,30,20',
      'PRESTATION,Peinture,lot,10,20',
      'AUTRE,X,m2,1,2',
      'PRESTATION,Enduit,m2,,',
      'PRESTATION,Placo,m2,abc,20',
    ].join('\r\n');
    const r = lireCsv(csv);
    expect(r.lignes).toEqual([]);
    expect(r.erreurs.map((e) => e.ligne)).toEqual([2, 3, 4, 6]);
    expect(r.erreurs[0].raison).toMatch(/plus grand/);
  });

  it('missing columns: the template is suggested', () => {
    expect(lireCsv('nom;prix\nA;1').erreurs[0].raison).toMatch(
      /Colonnes manquantes : type, unite, prix_min, prix_max/,
    );
  });

  it('helpers: units, prices, names, Windows-1252, cells', () => {
    expect(lireUnite('ML')).toBe('ML');
    expect(lireUnite('m³')).toBe('M3');
    expect(lireUnite('Forfait')).toBe('FORFAIT');
    expect(lireUnite('lot')).toBeNull();
    expect(lirePrix('1 234,50 €')).toBe(1234.5);
    expect(lirePrix('-3')).toBeNull();
    expect(normaliserNom('  Pose  Carrelage-Sol ')).toBe(normaliserNom('pose carrelage sol'));
    expect(normaliserNom('Dépose')).toBe('depose');
    expect(decoderTexte(Buffer.from([0x44, 0xe9, 0x70, 0x6f, 0x73, 0x65]))).toBe('Dépose'); // « Dépose » in Windows-1252
    expect(decoderTexte(Buffer.from('\uFEFFtype', 'utf8'))).toBe('type');
    expect(celluleCsv('a;b')).toBe('"a;b"');
    expect(celluleCsv(12.5)).toBe('12,5');
  });
});
