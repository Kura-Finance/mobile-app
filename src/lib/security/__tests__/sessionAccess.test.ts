import { describe, expect, test } from 'vitest';
import { resolveUsableAuthToken } from '../sessionAccessCore';

describe('sessionAccess', () => {
  test('resolveUsableAuthToken returns token when unlocked', () => {
    expect(
      resolveUsableAuthToken({ authToken: 'jwt-token', sessionLockStatus: 'unlocked' }),
    ).toBe('jwt-token');
  });

  test('resolveUsableAuthToken returns null when locked', () => {
    expect(
      resolveUsableAuthToken({ authToken: 'jwt-token', sessionLockStatus: 'locked' }),
    ).toBeNull();
  });

  test('resolveUsableAuthToken returns null when checking', () => {
    expect(
      resolveUsableAuthToken({ authToken: 'jwt-token', sessionLockStatus: 'checking' }),
    ).toBeNull();
  });

  test('resolveUsableAuthToken returns null when token missing', () => {
    expect(
      resolveUsableAuthToken({ authToken: null, sessionLockStatus: 'unlocked' }),
    ).toBeNull();
  });
});
