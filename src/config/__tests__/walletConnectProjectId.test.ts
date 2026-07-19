import { describe, expect, it } from 'vitest';
import {
  INVALID_WALLET_CONNECT_PROJECT_IDS,
  assertValidWalletConnectProjectId,
  normalizeWalletConnectProjectId,
} from '../walletConnectProjectId';

describe('normalizeWalletConnectProjectId', () => {
  it('rejects known placeholder project ids', () => {
    for (const placeholder of INVALID_WALLET_CONNECT_PROJECT_IDS) {
      expect(normalizeWalletConnectProjectId(placeholder)).toBe('');
    }
  });

  it('accepts real project ids', () => {
    expect(normalizeWalletConnectProjectId('a1b2c3d4e5f6g7h8i9j0')).toBe('a1b2c3d4e5f6g7h8i9j0');
  });

  it('trims whitespace', () => {
    expect(normalizeWalletConnectProjectId('  abc123  ')).toBe('abc123');
  });

  it('returns empty for blank input', () => {
    expect(normalizeWalletConnectProjectId('   ')).toBe('');
  });
});

describe('assertValidWalletConnectProjectId', () => {
  it('throws for placeholder ids', () => {
    expect(() => assertValidWalletConnectProjectId('development_project_id')).toThrow(
      /EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID/,
    );
  });

  it('returns normalized id when valid', () => {
    expect(assertValidWalletConnectProjectId('abc123')).toBe('abc123');
  });
});
