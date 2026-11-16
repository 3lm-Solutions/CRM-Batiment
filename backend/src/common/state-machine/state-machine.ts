import { BusinessException } from '../exceptions/business.exception';

/**
 * Declarative state machine for any status enum.
 * The transition table is the single source of truth; services only call `assert`.
 *
 * @example
 *   export const ChantierMachine = defineStateMachine('CHANTIER', 'chantier', { PLANIFIE: ['EN_COURS'], … });
 *   ChantierMachine.assert(chantier.statut, 'EN_COURS');
 */
export function defineStateMachine<S extends string>(
  code: string,
  label: string,
  transitions: Record<S, readonly S[]>,
) {
  const can = (from: S, to: S) => transitions[from].includes(to);
  return {
    transitions,
    can,
    assert(from: S, to: S): void {
      if (can(from, to)) return;
      const allowed = transitions[from];
      throw new BusinessException(
        `TRANSITION_${code}_INTERDITE`,
        `Transition ${from} → ${to} impossible pour ce ${label}. ` +
          (allowed.length
            ? `Depuis ${from} : ${allowed.join(', ')}.`
            : `${from} est un statut final.`),
      );
    },
    /** States from which `to` can be reached — for conditional (race-safe) updates. */
    sources: (to: S): S[] => (Object.keys(transitions) as S[]).filter((from) => can(from, to)),
    isFinal: (state: S) => transitions[state].length === 0,
  };
}
