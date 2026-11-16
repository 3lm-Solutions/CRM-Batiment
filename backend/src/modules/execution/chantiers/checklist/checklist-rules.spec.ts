import { checklistProgress } from './checklist-rules';

describe('checklist → avancement de la tâche', () => {
  it('is the share of ticked items, rounded', () => {
    expect(checklistProgress([{ fait: true }, { fait: false }, { fait: false }])).toBe(33);
    expect(checklistProgress([{ fait: true }, { fait: true }])).toBe(100);
    expect(checklistProgress([{ fait: false }])).toBe(0);
  });
  it('is null without a checklist (progress stays manual)', () => {
    expect(checklistProgress([])).toBeNull();
  });
});
