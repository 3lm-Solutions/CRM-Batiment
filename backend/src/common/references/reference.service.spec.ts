import { formatReference } from './reference.service';

describe('formatReference', () => {
  it('pads to 4 digits', () => {
    expect(formatReference('DEV', 2026, 7)).toBe('DEV-2026-0007');
  });

  it('keeps growing past 9999', () => {
    expect(formatReference('FAC', 2026, 12345)).toBe('FAC-2026-12345');
  });
});
