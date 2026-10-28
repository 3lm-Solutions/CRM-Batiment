import { assertJourPhoto, assertNombrePhotos, jourPhoto } from './photos-rules';

const now = new Date('2026-10-26T15:00:00Z');
const code = (fn: () => void) => {
  try {
    fn();
    return 'OK';
  } catch (e) {
    return (e as { getResponse?: () => { code: string } }).getResponse?.().code ?? String(e);
  }
};

describe('Photos d’avancement — règles (26/10)', () => {
  it('normalises the day (today by default)', () => {
    expect(jourPhoto(undefined, now).toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(jourPhoto('2026-10-20', now).toISOString()).toBe('2026-10-20T00:00:00.000Z');
  });

  it('refuses a future day and one older than 60 days', () => {
    expect(code(() => assertJourPhoto(jourPhoto('2026-10-26'), now))).toBe('OK');
    expect(code(() => assertJourPhoto(jourPhoto('2026-08-27'), now))).toBe('OK');
    expect(code(() => assertJourPhoto(jourPhoto('2026-10-27'), now))).toBe('DATE_FUTURE');
    expect(code(() => assertJourPhoto(jourPhoto('2026-08-26'), now))).toBe('DATE_TROP_ANCIENNE');
  });

  it('1 to 10 photos per upload', () => {
    expect(code(() => assertNombrePhotos(0))).toBe('FICHIER_MANQUANT');
    expect(code(() => assertNombrePhotos(10))).toBe('OK');
    expect(code(() => assertNombrePhotos(11))).toBe('TROP_DE_PHOTOS');
  });
});
