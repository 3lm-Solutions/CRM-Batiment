import { toDecimal } from '../../../common';
import { sansPrix, type PropositionView } from './devis-ia.service';

describe('Devis IA — vue du chef de chantier', () => {
  it('removes every price, total and market price, keeps the rest', () => {
    const vue: PropositionView = {
      modeIA: true,
      lignes: [
        {
          prestationId: 1,
          nom: 'Pose carrelage',
          categorie: 'Sols',
          unite: 'M2',
          quantite: 20,
          prixUnitaireHT: toDecimal(45),
          totalHT: toDecimal(900),
          justification: '20 m² indiqués',
          marche: null,
          positionMarche: null,
        },
      ],
      nonCouverts: ['Plinthes'],
      hypotheses: ['Surface au sol'],
      totalHT: toDecimal(900),
      avertissement: null,
      analysePhoto: null,
    };
    const chef = sansPrix(vue);
    expect(chef).toEqual({
      modeIA: true,
      lignes: [
        {
          prestationId: 1,
          nom: 'Pose carrelage',
          categorie: 'Sols',
          unite: 'M2',
          quantite: 20,
          justification: '20 m² indiqués',
        },
      ],
      nonCouverts: ['Plinthes'],
      hypotheses: ['Surface au sol'],
      avertissement: null,
      analysePhoto: null,
    });
    expect(JSON.stringify(chef)).not.toMatch(/prix|total|marche/i);
  });
});
