import { BusinessException } from '../exceptions/business.exception';
import { defineStateMachine } from './state-machine';

const M = defineStateMachine('TEST', 'objet', { A: ['B'], B: ['C', 'A'], C: [] } as Record<'A' | 'B' | 'C', ('A' | 'B' | 'C')[]>);

describe('defineStateMachine', () => {
  it('allows declared transitions only', () => {
    expect(M.can('A', 'B')).toBe(true);
    expect(M.can('A', 'C')).toBe(false);
    expect(() => M.assert('A', 'C')).toThrow(BusinessException);
  });
  it('error code is derived from the machine code', () => {
    try {
      M.assert('C', 'A');
    } catch (e) {
      expect((e as BusinessException).code).toBe('TRANSITION_TEST_INTERDITE');
    }
  });
  it('lists sources and finals', () => {
    expect(M.sources('A')).toEqual(['B']);
    expect(M.isFinal('C')).toBe(true);
  });
});
