import { statutsInferieurs } from './client-statut';

describe('Statut prospect / client (27/10)', () => {
  it('only promotes upwards', () => {
    expect(statutsInferieurs('PROSPECT')).toEqual([]);
    expect(statutsInferieurs('QUALIFIE')).toEqual(['PROSPECT']);
    expect(statutsInferieurs('CLIENT')).toEqual(['PROSPECT', 'QUALIFIE']);
  });
});
