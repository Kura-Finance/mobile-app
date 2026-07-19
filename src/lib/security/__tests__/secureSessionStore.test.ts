import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import {
  STANDARD_SECURE_STORE,
} from '../secureStoreOptions';

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
}));

vi.mock('../../../shared/utils/Logger', () => ({
  default: {
    debug: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

const TOKEN_KEY = 'kura.auth.token';
const SESSION_FLAG_KEY = 'kura.auth.sessionPresent';

describe('secureSessionStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function loadModule() {
    return import('../secureSessionStore');
  }

  test('saveSecureSession stores JWT without OS-level authentication', async () => {
    const { saveSecureSession } = await loadModule();

    await saveSecureSession('jwt-token');

    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      TOKEN_KEY,
      'jwt-token',
      STANDARD_SECURE_STORE,
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      SESSION_FLAG_KEY,
      '2',
      STANDARD_SECURE_STORE,
    );
  });

  test('loadSecureSession afterLocalAuth reads standard storage without authenticated fallback', async () => {
    vi.mocked(SecureStore.getItemAsync).mockImplementation(async (key, options) => {
      if (
        key === TOKEN_KEY
        && options
        && !('requireAuthentication' in options)
      ) {
        return 'jwt-token';
      }
      return null;
    });

    const { loadSecureSession } = await loadModule();
    const token = await loadSecureSession({ afterLocalAuth: true });

    expect(token).toBe('jwt-token');
    expect(SecureStore.getItemAsync).not.toHaveBeenCalledWith(
      TOKEN_KEY,
      expect.objectContaining({ requireAuthentication: true }),
    );
  });

  test('loadSecureSession afterLocalAuth migrates legacy authenticated storage once', async () => {
    vi.mocked(SecureStore.getItemAsync).mockImplementation(async (key, options) => {
      if (key === SESSION_FLAG_KEY) return '1';
      if (
        key === TOKEN_KEY
        && options
        && !('requireAuthentication' in options)
      ) {
        return null;
      }
      if (
        key === TOKEN_KEY
        && options
        && 'requireAuthentication' in options
        && options.requireAuthentication
      ) {
        return 'legacy-jwt';
      }
      return null;
    });

    const { loadSecureSession } = await loadModule();
    const token = await loadSecureSession({ afterLocalAuth: true });

    expect(token).toBe('legacy-jwt');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      TOKEN_KEY,
      'legacy-jwt',
      STANDARD_SECURE_STORE,
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      SESSION_FLAG_KEY,
      '2',
      STANDARD_SECURE_STORE,
    );
  });
});
