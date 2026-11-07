import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

describe('Device Command Integrity & Replay Protection', () => {
  it('generates unique nonces for each command and rejects replays', () => {
    const executedNonces = new Set<string>();

    const executeCommand = (commandId: string, nonce: string): { success: boolean; error?: string } => {
      if (executedNonces.has(nonce)) {
        return { success: false, error: 'Replay attack blocked: nonce already used' };
      }
      executedNonces.add(nonce);
      return { success: true };
    };

    const nonce1 = crypto.randomUUID();
    const nonce2 = crypto.randomUUID();

    // First execution succeeds
    expect(executeCommand('cmd-1', nonce1).success).toBe(true);

    // Replay with identical nonce fails
    expect(executeCommand('cmd-1-replay', nonce1).success).toBe(false);

    // Fresh command succeeds
    expect(executeCommand('cmd-2', nonce2).success).toBe(true);
  });

  it('rejects commands whose expiration timestamp is in the past', () => {
    const isCommandExpired = (expiresAt: Date): boolean => {
      return Date.now() > expiresAt.getTime();
    };

    const pastDate = new Date(Date.now() - 60000); // 1 minute ago
    const futureDate = new Date(Date.now() + 60000); // 1 minute from now

    expect(isCommandExpired(pastDate)).toBe(true);
    expect(isCommandExpired(futureDate)).toBe(false);
  });
});
