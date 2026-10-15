import { BusinessException } from '../../../common';
import { assertDateRange, chantierProgress, normalizeTaskProgress } from './tache-rules';
import { ChantierMachine } from './chantier-status';

describe('task rules', () => {
  const base = { statut: 'A_FAIRE' as const, avancement: 0 };

  it('TERMINEE forces 100 % and 100 % forces TERMINEE', () => {
    expect(normalizeTaskProgress(base, { statut: 'TERMINEE' })).toEqual({ statut: 'TERMINEE', avancement: 100 });
    expect(normalizeTaskProgress(base, { avancement: 100 })).toEqual({ statut: 'TERMINEE', avancement: 100 });
  });

  it('progress on a task to do starts it', () => {
    expect(normalizeTaskProgress(base, { avancement: 30 })).toEqual({ statut: 'EN_COURS', avancement: 30 });
  });

  it('lowering progress of a finished task reopens it', () => {
    expect(normalizeTaskProgress({ statut: 'TERMINEE', avancement: 100 }, { avancement: 80 })).toEqual({
      statut: 'EN_COURS',
      avancement: 80,
    });
  });

  it('a blocked task keeps its status', () => {
    expect(normalizeTaskProgress({ statut: 'BLOQUEE', avancement: 40 }, { avancement: 50 }).statut).toBe('BLOQUEE');
  });

  it('refuses an end date before the start date', () => {
    expect(() => assertDateRange('2026-05-10', '2026-05-01')).toThrow(BusinessException);
    expect(() => assertDateRange('2026-05-01', null)).not.toThrow();
  });

  it('job site progress is the average of its tasks', () => {
    expect(chantierProgress([])).toBe(0);
    expect(chantierProgress([{ avancement: 100 }, { avancement: 50 }])).toBe(75);
  });
});

describe('chantier state machine', () => {
  it('follows the execution flow', () => {
    expect(ChantierMachine.can('PLANIFIE', 'EN_COURS')).toBe(true);
    expect(ChantierMachine.can('EN_COURS', 'SUSPENDU')).toBe(true);
    expect(ChantierMachine.can('TERMINE', 'EN_COURS')).toBe(true); // reserves after handover
    expect(ChantierMachine.can('PLANIFIE', 'CLOTURE')).toBe(false);
    expect(ChantierMachine.isFinal('CLOTURE')).toBe(true);
  });
});
