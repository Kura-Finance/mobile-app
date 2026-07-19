import { describe, expect, test, vi } from 'vitest';

import {
  formatDisplayError,
  userFacingTransactionError,
} from '../userFacingTransactionError';

vi.mock('../../../shared/locales/i18n', () => ({
  default: {
    t: (key: string, opts?: { reason?: string }) =>
      opts?.reason ? `${key}:${opts.reason}` : key,
  },
}));

vi.mock('../../../features/card/config/cardWalletConfig', () => ({
  PAY_GAS_IN_USDC: true,
}));

describe('userFacingTransactionError', () => {
  test('replaces Request Argument Error with callData blob', () => {
    const err = new Error(
      `Request Argument Error\n\ncallData: 0x${'a'.repeat(512)}`,
    );
    expect(userFacingTransactionError(err)).toBe('crypto.transactionFailed');
  });

  test('keeps short user-facing validation messages', () => {
    expect(formatDisplayError('Enter a valid Ethereum address.')).toBe(
      'Enter a valid Ethereum address.',
    );
  });

  test('maps user rejection', () => {
    expect(userFacingTransactionError(new Error('User rejected the request.'))).toBe(
      'crypto.transactionRejected',
    );
  });

  test('truncates long hex segments in otherwise readable messages', () => {
    const msg = `Simulation failed for 0x${'b'.repeat(80)}`;
    expect(formatDisplayError(msg)).toBe('Simulation failed for 0x…');
  });

  test('uses headline when technical dump has a short first line', () => {
    const msg = `Execution reverted\n\ncallData: 0x${'c'.repeat(128)}`;
    expect(formatDisplayError(msg)).toBe(
      'crypto.transactionFailedWithReason:Execution reverted',
    );
  });
});
