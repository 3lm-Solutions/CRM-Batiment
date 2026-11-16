import { niveauDu } from './relance-rules';

const now = new Date('2026-10-21T08:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe('niveauDu (automatic reminders, C3)', () => {
  it('sends level 1 once the first delay is reached, then level 2 at the second delay', () => {
    expect(niveauDu(6, [7, 14], [], null, now)).toBeNull();
    expect(niveauDu(7, [7, 14], [], null, now)).toBe(1);
    expect(niveauDu(10, [7, 14], [1], daysAgo(3), now)).toBeNull();
    expect(niveauDu(14, [7, 14], [1], daysAgo(7), now)).toBe(2);
    expect(niveauDu(40, [7, 14], [1, 2], daysAgo(20), now)).toBeNull(); // all levels sent
  });

  it('catches up one level per run, never two at once', () => {
    expect(niveauDu(31, [1, 15, 30], [], null, now)).toBe(1);
    expect(niveauDu(31, [1, 15, 30], [1], daysAgo(1), now)).toBeNull(); // 2 days minimum between two reminders
    expect(niveauDu(33, [1, 15, 30], [1], daysAgo(2), now)).toBe(2);
  });

  it('waits after a manual reminder, and ignores unsorted / duplicate delays', () => {
    expect(niveauDu(8, [14, 7, 7], [], daysAgo(1), now)).toBeNull();
    expect(niveauDu(8, [14, 7, 7], [], daysAgo(5), now)).toBe(1);
  });
});
