import { Injectable } from '@nestjs/common';
import { compare, hash } from 'bcryptjs';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

const BCRYPT_ROUNDS = 12;
// No 0/O, 1/l/I: temporary passwords are read from an email and typed by hand
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Everything about secrets: hashing, comparing, generating temporary passwords and codes. */
@Injectable()
export class PasswordService {
  /**
   * Compared against when the email does not exist, so a login for an unknown email takes
   * as long as one for a known email (otherwise response time reveals which emails exist).
   */
  private readonly dummyHash = hash('timing-equalizer-not-a-real-password', BCRYPT_ROUNDS);

  hash(plain: string): Promise<string> {
    return hash(plain, BCRYPT_ROUNDS);
  }

  /** Always runs one bcrypt comparison, even when there is no stored hash. */
  async verify(plain: string, storedHash: string | null | undefined): Promise<boolean> {
    const matches = await compare(plain, storedHash ?? (await this.dummyHash));
    return Boolean(storedHash) && matches;
  }

  /** 12 characters, always at least one uppercase, one lowercase and one digit. */
  generateTemporaryPassword(length = 12): string {
    for (;;) {
      const candidate = Array.from(
        { length },
        () => TEMP_ALPHABET[randomInt(TEMP_ALPHABET.length)],
      ).join('');
      if (/[A-Z]/.test(candidate) && /[a-z]/.test(candidate) && /\d/.test(candidate)) {
        return candidate;
      }
    }
  }

  /** 6 digits, cryptographically random. */
  generateResetCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  hashResetCode(code: string): string {
    return createHash('sha256').update(code.trim()).digest('hex');
  }

  /** Constant-time comparison (the old code used `!==`). */
  resetCodeMatches(code: string, storedHash: string): boolean {
    const a = Buffer.from(this.hashResetCode(code), 'hex');
    const b = Buffer.from(storedHash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}
