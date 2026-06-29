import { describe, expect, test } from 'vitest';
import { KuraApiError } from '../../errors';
import {
  formatDinariErrorForLog,
  getDinariConnectErrorMessage,
  isDinariAccountEnvMismatchError,
  isDinariKycRequiredError,
  isDinariWhitelistError,
  isDinariWalletMismatchError,
} from '../errors';

describe('isDinariWhitelistError', () => {
  test('returns true for 403 whitelist message', () => {
    const error = new KuraApiError({
      status: 403,
      code: 'FORBIDDEN',
      message: 'This user not on whitelist',
    });
    expect(isDinariWhitelistError(error)).toBe(true);
  });

  test('returns true for NOT_ON_WHITELIST code', () => {
    const error = new KuraApiError({
      status: 403,
      code: 'NOT_ON_WHITELIST',
      message: 'Access denied',
    });
    expect(isDinariWhitelistError(error)).toBe(true);
  });

  test('returns false for other 403 errors', () => {
    const error = new KuraApiError({
      status: 403,
      code: 'FORBIDDEN',
      message: 'Insufficient permissions',
    });
    expect(isDinariWhitelistError(error)).toBe(false);
  });

  test('returns false for non-403 errors', () => {
    const error = new KuraApiError({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Entity not found',
    });
    expect(isDinariWhitelistError(error)).toBe(false);
  });
});

describe('isDinariKycRequiredError', () => {
  test('returns true for 403 KYC message', () => {
    const error = new KuraApiError({
      status: 403,
      code: 'FORBIDDEN',
      message: 'KYC must pass before wallet connect',
    });
    expect(isDinariKycRequiredError(error)).toBe(true);
  });

  test('returns false for whitelist 403', () => {
    const error = new KuraApiError({
      status: 403,
      code: 'NOT_ON_WHITELIST',
      message: 'Not on whitelist',
    });
    expect(isDinariKycRequiredError(error)).toBe(false);
  });
});

describe('isDinariWalletMismatchError', () => {
  test('returns true for wallet mismatch 400', () => {
    const error = new KuraApiError({
      status: 400,
      code: 'BAD_REQUEST',
      message: 'walletAddress must match PATCH /api/wallet/sca',
    });
    expect(isDinariWalletMismatchError(error)).toBe(true);
  });
});

describe('isDinariAccountEnvMismatchError', () => {
  test('returns true for sandbox account 409', () => {
    const error = new KuraApiError({
      status: 409,
      code: 'CONFLICT',
      message: 'Dinari account not found in sandbox environment',
    });
    expect(isDinariAccountEnvMismatchError(error)).toBe(true);
  });
});

describe('formatDinariErrorForLog', () => {
  test('expands nested field_errors', () => {
    const error = new KuraApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: {
        error: {
          field_errors: [
            { field: 'chain_id', message: 'unsupported chain' },
            { field: 'wallet_address', message: 'invalid format' },
          ],
          error_id: 'abc-123',
        },
      },
    });

    expect(formatDinariErrorForLog(error)).toEqual({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fieldErrors: [
        'chain_id: unsupported chain',
        'wallet_address: invalid format',
      ],
      errorId: 'abc-123',
    });
  });

  test('extracts error_id from message when details missing', () => {
    const error = new KuraApiError({
      status: 422,
      code: 'DINARI_ERROR',
      message: '422 Unprocessable Entity: error_id=req:WPpHsx-hRtOfwgtTd9t2aw',
    });

    expect(formatDinariErrorForLog(error)).toEqual({
      status: 422,
      code: 'DINARI_ERROR',
      message: '422 Unprocessable Entity: error_id=req:WPpHsx-hRtOfwgtTd9t2aw',
      fieldErrors: undefined,
      errorId: 'req:WPpHsx-hRtOfwgtTd9t2aw',
    });
  });

  test('reads field_errors from error envelope extras', () => {
    const error = new KuraApiError({
      status: 422,
      code: 'DINARI_ERROR',
      message: 'Validation failed',
      details: {
        field_errors: [{ field: 'chain_id', message: 'must be eip155:8453' }],
      },
    });

    expect(formatDinariErrorForLog(error).fieldErrors).toEqual([
      'chain_id: must be eip155:8453',
    ]);
  });
});

describe('getDinariConnectErrorMessage', () => {
  test('appends field_errors to backend message', () => {
    const error = new KuraApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Dinari rejected request',
      details: {
        field_errors: [{ field: 'chain_id', message: 'must be eip155:8453' }],
      },
    });

    expect(getDinariConnectErrorMessage(error)).toBe(
      'Dinari could not issue a wallet nonce. (chain_id: must be eip155:8453)',
    );
  });

  test('422 with only error_id in message gives actionable hint', () => {
    const error = new KuraApiError({
      status: 422,
      code: 'DINARI_ERROR',
      message: '422 Unprocessable Entity: error_id=req:WPpHsx-hRtOfwgtTd9t2aw',
    });

    expect(getDinariConnectErrorMessage(error)).toBe(
      'Dinari could not issue a wallet nonce. Ensure KYC has passed and your smart account matches PATCH /api/wallet/sca. (error_id: req:WPpHsx-hRtOfwgtTd9t2aw)',
    );
  });
});
