import { describe, expect, test } from 'vitest';
import { KuraApiError } from '../../errors';
import { isDinariWhitelistError } from '../errors';

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
