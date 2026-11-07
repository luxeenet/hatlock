import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';

describe('Authentication & Security Invariants', () => {
  it('should hash passwords using bcrypt with adequate work factor', async () => {
    const password = 'StrongPassword2026!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.startsWith('$2a$') || hash.startsWith('$2b$')).toBe(true);

    const isMatch = await bcrypt.compare(password, hash);
    expect(isMatch).toBe(true);

    const isWrongMatch = await bcrypt.compare('WrongPassword', hash);
    expect(isWrongMatch).toBe(false);
  });

  it('should prevent empty or weak passwords', () => {
    const validatePassword = (pass: string): { valid: boolean; reason?: string } => {
      if (!pass || pass.length < 8) {
        return { valid: false, reason: 'Password must be at least 8 characters long' };
      }
      if (!/[A-Z]/.test(pass) || !/[0-9]/.test(pass)) {
        return { valid: false, reason: 'Password must include uppercase letter and number' };
      }
      return { valid: true };
    };

    expect(validatePassword('short').valid).toBe(false);
    expect(validatePassword('nouppercase123').valid).toBe(false);
    expect(validatePassword('ValidPass123').valid).toBe(true);
  });
});
