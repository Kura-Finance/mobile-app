/**
 * App background lock.
 *
 * Clears in-memory sensitive material when the app has been in the background
 * longer than the configured threshold:
 *   - CryptoSession (X25519 keys for E2EE API responses)
 *   - TrackFi DEK (Data Encryption Key for TrackFi data, requires Passkey re-auth)
 *
 * The auth session itself (Privy token in SecureStore) is NOT cleared — only
 * decryption material is dropped.
 */

import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { clearCryptoSession, getCryptoSession } from '../crypto/session';
import { clearDataKey } from '../crypto/dataKeySession';
import { isPlaidOAuthInProgress } from '../../shared/utils/plaidOAuthState';
import Logger from '../../shared/utils/Logger';
import {
  DEFAULT_BACKGROUND_LOCK_MS,
  handleAppStateChange,
} from './appLockReducer';

export { DEFAULT_BACKGROUND_LOCK_MS, handleAppStateChange };

interface AppLockState {
  thresholdMs: number;
  backgroundedAt: number | null;
  subscription: NativeEventSubscription | null;
  /** Override hook for tests. */
  now: () => number;
  /** Override hook for tests. */
  clearSession: () => void;
}

const state: AppLockState = {
  thresholdMs: DEFAULT_BACKGROUND_LOCK_MS,
  backgroundedAt: null,
  subscription: null,
  now: () => Date.now(),
  clearSession: () => clearCryptoSession(),
};

function onAppStateChange(currentStatus: AppStateStatus): void {
  const previousStatus = AppState.currentState;
  const { nextBackgroundedAt, shouldLock } = handleAppStateChange(
    previousStatus,
    currentStatus,
    {
      thresholdMs: state.thresholdMs,
      backgroundedAt: state.backgroundedAt,
      now: state.now,
    },
  );
  state.backgroundedAt = nextBackgroundedAt;

  if (shouldLock) {
    // A Plaid link/OAuth handoff backgrounds the app to the bank's native auth
    // flow. Clearing the DEK / crypto session here re-locks the TrackFi gate,
    // which unmounts the entire TrackFi tree (including PlaidLinkModal) and aborts
    // the in-flight Plaid session — the redirect comes back to nothing. Skip the
    // lock while a handoff is in progress; the flag auto-expires after 6 minutes.
    if (isPlaidOAuthInProgress()) {
      Logger.info('AppLock', 'Skipping background lock — Plaid link/OAuth handoff in progress');
      return;
    }
    if (getCryptoSession() !== null) {
      Logger.warn('AppLock', 'Background threshold exceeded; clearing crypto session', {
        thresholdMs: state.thresholdMs,
      });
      state.clearSession();
    }
    clearDataKey();
  }
}

export interface InstallAppLockOptions {
  thresholdMs?: number;
  now?: () => number;
  clearSession?: () => void;
}

/**
 * Subscribe to AppState. Returns a teardown function.
 *
 * Safe to call multiple times — repeated calls reinstall with the new
 * options and clean up the previous subscription.
 */
export function installAppLock(options: InstallAppLockOptions = {}): () => void {
  uninstallAppLock();

  if (typeof options.thresholdMs === 'number' && options.thresholdMs > 0) {
    state.thresholdMs = options.thresholdMs;
  }
  if (options.now) state.now = options.now;
  if (options.clearSession) state.clearSession = options.clearSession;

  state.subscription = AppState.addEventListener('change', onAppStateChange);
  Logger.debug('AppLock', 'AppLock installed', { thresholdMs: state.thresholdMs });
  return uninstallAppLock;
}

export function uninstallAppLock(): void {
  if (state.subscription) {
    state.subscription.remove();
    state.subscription = null;
  }
  state.backgroundedAt = null;
}

/** Test hook: reset to defaults. */
export function __resetAppLockForTesting(): void {
  uninstallAppLock();
  state.thresholdMs = DEFAULT_BACKGROUND_LOCK_MS;
  state.now = () => Date.now();
  state.clearSession = () => clearCryptoSession();
}
