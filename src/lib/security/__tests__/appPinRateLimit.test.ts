import { afterEach, describe, expect, test } from 'vitest';
import {
  __resetPinRateLimitForTesting,
  isPinLockedOut,
  recordPinFailure,
  resetPinAttempts,
} from '../appPinRateLimit';

describe('appPinRateLimit', () => {
  afterEach(() => {
    __resetPinRateLimitForTesting();
  });

  test('locks out after repeated failures', () => {
    for (let i = 0; i < 5; i += 1) {
      recordPinFailure();
    }
    expect(isPinLockedOut()).toBe(true);
  });

  test('resets after successful unlock path', () => {
    recordPinFailure();
    resetPinAttempts();
    expect(isPinLockedOut()).toBe(false);
  });
});
