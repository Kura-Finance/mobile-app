/**
 * App background lock.
 *
 * When the app returns to the foreground after being backgrounded, require
 * biometric re-unlock before the session can be used again:
 *   - Session token stays in memory (API access is blocked until unlock)
 *   - CryptoSession / TrackFi DEK are cleared on resume
 *
 * Going to background only snapshots the auth token to SecureStore — nothing
 * is cleared until the user comes back and must verify.
 */

import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { clearCryptoSession } from '../crypto/session';
import { saveSecureSession } from './secureSessionStore';
import { isPlaidOAuthInProgress } from '../../shared/utils/plaidOAuthState';
import Logger from '../../shared/utils/Logger';
import { useAppStore } from '../../shared/store/useAppStore';
import { handleAppStateChange } from './appLockReducer';

export { handleAppStateChange };

interface AppLockState {
  backgroundedAt: number | null;
  lastAppState: AppStateStatus;
  subscription: NativeEventSubscription | null;
  /** Override hook for tests. */
  now: () => number;
  /** Override hook for tests. */
  clearSession: () => void;
}

const state: AppLockState = {
  backgroundedAt: null,
  lastAppState: 'active',
  subscription: null,
  now: () => Date.now(),
  clearSession: () => clearCryptoSession(),
};

function onAppStateChange(nextStatus: AppStateStatus): void {
  const previousStatus = state.lastAppState;
  const { nextBackgroundedAt, shouldRequireBiometric } = handleAppStateChange(
    previousStatus,
    nextStatus,
    {
      backgroundedAt: state.backgroundedAt,
      now: state.now,
    },
  );
  state.backgroundedAt = nextBackgroundedAt;
  state.lastAppState = nextStatus;

  const wentToBackground = nextStatus === 'background' && previousStatus !== 'background';
  if (wentToBackground) {
    const { authToken } = useAppStore.getState();
    if (authToken) {
      void saveSecureSession(authToken);
    }
  }

  if (shouldRequireBiometric) {
    // A Plaid link/OAuth handoff backgrounds the app to the bank's native auth
    // flow. Clearing the DEK / crypto session here re-locks the TrackFi gate,
    // which unmounts the entire TrackFi tree (including PlaidLinkModal) and aborts
    // the in-flight Plaid session — the redirect comes back to nothing. Skip the
    // lock while a handoff is in progress; the flag auto-expires after 6 minutes.
    if (isPlaidOAuthInProgress()) {
      Logger.info('AppLock', 'Skipping biometric gate — Plaid link/OAuth handoff in progress');
      return;
    }
    useAppStore.getState().requireBiometricUnlock();
  }
}

export interface InstallAppLockOptions {
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

  if (options.now) state.now = options.now;
  if (options.clearSession) state.clearSession = options.clearSession;

  state.lastAppState = AppState.currentState;
  state.subscription = AppState.addEventListener('change', onAppStateChange);
  Logger.debug('AppLock', 'AppLock installed');
  return uninstallAppLock;
}

export function uninstallAppLock(): void {
  if (state.subscription) {
    state.subscription.remove();
    state.subscription = null;
  }
  state.backgroundedAt = null;
  state.lastAppState = 'active';
}

/** Test hook: reset to defaults. */
export function __resetAppLockForTesting(): void {
  uninstallAppLock();
  state.now = () => Date.now();
  state.clearSession = () => clearCryptoSession();
}
