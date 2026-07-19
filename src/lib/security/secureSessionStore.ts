import * as SecureStore from 'expo-secure-store';
import Logger from '../../shared/utils/Logger';
import {
  AUTHENTICATED_SECURE_STORE,
  STANDARD_SECURE_STORE,
} from './secureStoreOptions';

const TOKEN_KEY = 'kura.auth.token';
/** Lightweight flag — avoids reading the JWT just to detect cold-start restore. */
const SESSION_FLAG_KEY = 'kura.auth.sessionPresent';
/** Flag value after JWT is stored without OS-level biometric read (app lock handles auth). */
const SESSION_FLAG_STANDARD = '2';
/** Legacy flag value — JWT may still require OS auth on read until migrated. */
const SESSION_FLAG_LEGACY = '1';
/** Legacy key — profile was moved out of SecureStore (2048-byte limit). */
const LEGACY_PROFILE_KEY = 'kura.auth.profile';

export type LoadSecureSessionOptions = {
  /**
   * Caller already verified App PIN or in-app biometrics.
   * Skips a second OS biometric prompt when the JWT is stored in standard SecureStore.
   */
  afterLocalAuth?: boolean;
};

async function readLegacyToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    return token || null;
  } catch (err) {
    Logger.warn('SecureSession', 'Failed to read legacy session token', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function readStandardToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY, STANDARD_SECURE_STORE);
    return token || null;
  } catch (err) {
    Logger.warn('SecureSession', 'Failed to read standard session token', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

async function readAuthenticatedToken(): Promise<string | null> {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY, AUTHENTICATED_SECURE_STORE);
    return token || null;
  } catch (err) {
    Logger.warn('SecureSession', 'Failed to read authenticated session token', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function saveSecureSession(token: string): Promise<void> {
  if (!token) return;
  try {
    // App-level session lock (PIN / biometrics) guards access; avoid a second OS prompt on read.
    await SecureStore.setItemAsync(TOKEN_KEY, token, STANDARD_SECURE_STORE);
    await SecureStore.setItemAsync(SESSION_FLAG_KEY, SESSION_FLAG_STANDARD, STANDARD_SECURE_STORE);
    await SecureStore.deleteItemAsync(LEGACY_PROFILE_KEY).catch(() => undefined);
    Logger.debug('SecureSession', 'Auth token persisted to SecureStore');
  } catch (err) {
    Logger.warn('SecureSession', 'Failed to persist session token', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function loadSecureSession(
  options: LoadSecureSessionOptions = {},
): Promise<string | null> {
  try {
    const standardToken = await readStandardToken();
    if (standardToken) {
      return standardToken;
    }

    if (options.afterLocalAuth) {
      const flag = await SecureStore.getItemAsync(SESSION_FLAG_KEY);
      if (flag === SESSION_FLAG_STANDARD) {
        return null;
      }

      // One-time migration from older builds that stored JWT with requireAuthentication.
      let token = await readAuthenticatedToken();
      if (!token) {
        token = await readLegacyToken();
      }
      if (token) {
        await saveSecureSession(token);
        return token;
      }
      return null;
    }

    const legacyToken = await readLegacyToken();
    if (legacyToken) {
      await saveSecureSession(legacyToken);
      return legacyToken;
    }

    return null;
  } catch (err) {
    Logger.warn('SecureSession', 'Failed to load session token', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function hasSecureSession(): Promise<boolean> {
  try {
    const flag = await SecureStore.getItemAsync(SESSION_FLAG_KEY);
    if (flag === SESSION_FLAG_STANDARD || flag === SESSION_FLAG_LEGACY) return true;
    const legacy = await readLegacyToken();
    if (legacy) {
      await SecureStore.setItemAsync(SESSION_FLAG_KEY, SESSION_FLAG_LEGACY, STANDARD_SECURE_STORE);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function clearSecureSession(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(SESSION_FLAG_KEY);
    await SecureStore.deleteItemAsync(LEGACY_PROFILE_KEY).catch(() => undefined);
    Logger.debug('SecureSession', 'Secure session cleared');
  } catch (err) {
    Logger.warn('SecureSession', 'Failed to clear session', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
