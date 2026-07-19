import * as SecureStore from 'expo-secure-store';
import Logger from '../../shared/utils/Logger';
import type { AppPinHashRecord } from './appPinCore';

const PIN_HASH_KEY = 'kura.security.appPinHash';

export async function saveAppPinHash(record: AppPinHashRecord): Promise<void> {
  try {
    await SecureStore.setItemAsync(PIN_HASH_KEY, JSON.stringify(record));
    Logger.debug('AppPin', 'App PIN hash persisted');
  } catch (err) {
    Logger.warn('AppPin', 'Failed to persist App PIN hash', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

export async function loadAppPinHash(): Promise<AppPinHashRecord | null> {
  try {
    const raw = await SecureStore.getItemAsync(PIN_HASH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppPinHashRecord;
    if (!parsed?.salt || !parsed?.hash) return null;
    return parsed;
  } catch (err) {
    Logger.warn('AppPin', 'Failed to load App PIN hash', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function hasAppPinHash(): Promise<boolean> {
  const record = await loadAppPinHash();
  return !!record;
}

export async function clearAppPinHash(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(PIN_HASH_KEY);
    Logger.debug('AppPin', 'App PIN hash cleared');
  } catch (err) {
    Logger.warn('AppPin', 'Failed to clear App PIN hash', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
