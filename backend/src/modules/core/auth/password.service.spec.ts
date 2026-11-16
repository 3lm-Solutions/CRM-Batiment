import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies a password', async () => {
    const hashed = await service.hash('Chantier2026');
    await expect(service.verify('Chantier2026', hashed)).resolves.toBe(true);
    await expect(service.verify('wrong', hashed)).resolves.toBe(false);
  });

  it('returns false (after a real comparison) when there is no stored hash', async () => {
    await expect(service.verify('anything', null)).resolves.toBe(false);
  });

  it('generates temporary passwords with upper, lower and digit, without ambiguous chars', () => {
    for (let i = 0; i < 50; i++) {
      const pwd = service.generateTemporaryPassword();
      expect(pwd).toHaveLength(12);
      expect(pwd).toMatch(/[A-Z]/);
      expect(pwd).toMatch(/[a-z]/);
      expect(pwd).toMatch(/\d/);
      expect(pwd).not.toMatch(/[0O1lI]/);
    }
  });

  it('generates 6-digit reset codes and matches them in constant time', () => {
    const code = service.generateResetCode();
    expect(code).toMatch(/^\d{6}$/);
    const stored = service.hashResetCode(code);
    expect(service.resetCodeMatches(code, stored)).toBe(true);
    expect(service.resetCodeMatches(code === '000000' ? '000001' : '000000', stored)).toBe(false);
  });
});
