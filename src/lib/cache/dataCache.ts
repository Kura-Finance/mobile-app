/**
 * Raw encrypted data cache.
 *
 * Stores the raw E2EE-encrypted API envelope (wrappedSek + ciphertext rows)
 * directly in AsyncStorage without any re-encryption. The data is already
 * encrypted by the backend and can only be decrypted with the user's
 * X25519 private key — safe to store at rest as-is.
 *
 * To show cached data when the in-memory CryptoSession has been cleared
 * (e.g. after AppLock fires), the caller restores the private key via
 * biometric auth (`restoreWithBiometrics`) and passes it directly to the
 * decrypt-from-cache helpers in each API client.
 *
 * Cache entry format in AsyncStorage:
 *   { v: 2, data: <raw API envelope>, ts: ISO }
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import Logger from '../../shared/utils/Logger';

const CACHE_VERSION = 2;
const CACHE_PREFIX = 'kura.rawcache.';
/** Legacy prefix — cleared by clearAllCache during migration. */
const LEGACY_CACHE_PREFIX = 'kura.datacache.';

interface RawCacheEntry {
  v: number;
  /** Raw API response (still E2EE-encrypted JSON) */
  data: unknown;
  /** ISO timestamp of when the entry was written */
  ts: string;
}

export interface CacheResult<T> {
  data: T;
  /** ISO timestamp the cache was last written */
  cachedAt: string;
}

// ─────────────────────────────────────────────────────────────
// Write
// ─────────────────────────────────────────────────────────────

export async function writeRawCache<T>(namespace: string, data: T): Promise<void> {
  try {
    const entry: RawCacheEntry = {
      v: CACHE_VERSION,
      data,
      ts: new Date().toISOString(),
    };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${namespace}`, JSON.stringify(entry));
  } catch (error) {
    Logger.warn('DataCache', `Write failed for ${namespace}`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ─────────────────────────────────────────────────────────────
// Read
// ─────────────────────────────────────────────────────────────

export async function readRawCache<T>(namespace: string): Promise<CacheResult<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}${namespace}`);
    if (!raw) return null;

    const entry: RawCacheEntry = JSON.parse(raw);
    if (entry.v !== CACHE_VERSION) {
      await AsyncStorage.removeItem(`${CACHE_PREFIX}${namespace}`);
      return null;
    }

    return { data: entry.data as T, cachedAt: entry.ts };
  } catch (error) {
    Logger.warn('DataCache', `Read failed for ${namespace}`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Delete / Clear
// ─────────────────────────────────────────────────────────────

export async function deleteRawCache(namespace: string): Promise<void> {
  await AsyncStorage.removeItem(`${CACHE_PREFIX}${namespace}`).catch(() => {});
}

export async function clearAllCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const toRemove = keys.filter(
      (k) => k.startsWith(CACHE_PREFIX) || k.startsWith(LEGACY_CACHE_PREFIX),
    );
    if (toRemove.length > 0) {
      await AsyncStorage.multiRemove(toRemove);
    }
  } catch {
    // best-effort
  }
}
