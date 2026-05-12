/**
 * useTrackFiDataKey
 *
 * Manages the full lifecycle of the TrackFi Passkey Gate:
 *
 *   idle        → user hasn't tried to unlock
 *   checking    → querying backend for passkey registration status
 *   unregistered→ no passkey on this account yet → show "Set up Passkey" UI
 *   locked      → passkey exists but DEK not in memory → show "Unlock" UI
 *   unlocking   → passkey dialog is open / request in flight
 *   unlocked    → DEK is in memory, TrackFi data is accessible
 *   error       → last attempt failed
 *
 * Typical lifecycle:
 *   idle → checking → locked → unlocking → unlocked
 *                           ↑_______________↓  (re-lock after timeout)
 *
 * Registration lifecycle:
 *   idle → checking → unregistered → unlocking (register) → unlocked
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '../../../shared/locales/i18n';
import {
  authenticatePasskeyForDek,
  getPasskeyStatus,
  passkeyIsSupported,
  registerPasskey,
  resetE2EE,
} from '../../../lib/auth/passkeyService';
import {
  clearDataKey,
  dataKeyTtlMs,
  getDataKey,
  isDataKeyLoaded,
  setDataKey,
} from '../../../lib/crypto/dataKeySession';
import { establishCryptoSession } from '../../../lib/crypto/keypairManager';
import { clearCryptoSession, getCryptoSession } from '../../../lib/crypto/session';
import { useAppStore } from '../../../shared/store/useAppStore';

export type DataKeyState =
  | 'idle'
  | 'checking'
  | 'unregistered'
  | 'locked'
  | 'unlocking'
  | 'unlocked'
  | 'error'
  /** Passkey exists on server but not on this device (new device / lost passkey). */
  | 'lost_passkey'
  /** Reset in progress: clearing E2EE layer then registering new passkey. */
  | 'resetting';

export interface UseTrackFiDataKeyReturn {
  state: DataKeyState;
  /** Human-readable error if state === 'error' */
  errorMessage: string;
  /** True if the device supports passkeys */
  isPasskeySupported: boolean;
  /** Remaining session time in ms (0 when locked) */
  ttlMs: number;
  /**
   * Monotonically increasing counter, incremented every time the session
   * transitions into `unlocked`. Use as a `useEffect` dependency to trigger
   * data fetches that require a crypto session (e.g. exchange balances).
   */
  unlockSeq: number;
  /** Initiate passkey authentication to unlock the DEK */
  unlock: () => Promise<void>;
  /** Register a new passkey (first time setup) */
  register: () => Promise<void>;
  /** Manually lock (clear DEK from memory) */
  lock: () => void;
  /**
   * Transition to lost_passkey state so the user can choose to reset.
   * Call this from the locked/error screen via a "Changed device?" link.
   */
  reportLostPasskey: () => void;
  /**
   * Reset the entire E2EE layer (server-side) then immediately register a
   * fresh passkey on this device.  Only callable from lost_passkey state.
   */
  resetAndReregister: () => Promise<void>;
}

export function useTrackFiDataKey(): UseTrackFiDataKeyReturn {
  const [state, setState] = useState<DataKeyState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [ttlMs, setTtlMs] = useState(0);
  const [unlockSeq, setUnlockSeq] = useState(0);

  const userProfile = useAppStore((s) => s.userProfile);
  const authToken = useAppStore((s) => s.authToken);
  const isPasskeySupported = passkeyIsSupported();

  const ttlIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── TTL ticker (updates every 30s while unlocked) ─────────────────────────

  const startTtlTicker = useCallback(() => {
    if (ttlIntervalRef.current) clearInterval(ttlIntervalRef.current);
    ttlIntervalRef.current = setInterval(() => {
      const remaining = dataKeyTtlMs();
      setTtlMs(remaining);
      if (remaining === 0) {
        setState('locked');
        clearInterval(ttlIntervalRef.current!);
        ttlIntervalRef.current = null;
      }
    }, 30_000);
  }, []);

  const stopTtlTicker = useCallback(() => {
    if (ttlIntervalRef.current) {
      clearInterval(ttlIntervalRef.current);
      ttlIntervalRef.current = null;
    }
  }, []);

  // ── Initial check ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authToken) return;
    let cancelled = false;

    // If DEK is already in memory from a previous session within this app launch
    if (isDataKeyLoaded()) {
      // Both DEK and crypto session present → fully unlocked.
      if (getCryptoSession()) {
        setState('unlocked');
        setUnlockSeq((s) => s + 1);
        setTtlMs(dataKeyTtlMs());
        startTtlTicker();
        return;
      }
      // DEK present but crypto session was dropped (or never built) → rebuild it
      // from the in-memory DEK without a fresh passkey prompt.
      const dek = getDataKey();
      if (dek) {
        setState('unlocking');
        establishCryptoSession(dek)
          .then(() => {
            if (cancelled) return;
            setState('unlocked');
            setUnlockSeq((s) => s + 1);
            setTtlMs(dataKeyTtlMs());
            startTtlTicker();
          })
          .catch((err) => {
            if (cancelled) return;
            setErrorMessage(err instanceof Error ? err.message : i18n.t('trackfi.authError'));
            setState('error');
          });
        return () => {
          cancelled = true;
          stopTtlTicker();
        };
      }
    }

    // Check registration status
    setState('checking');
    getPasskeyStatus()
      .then(({ registered }) => {
        if (cancelled) return;
        setState(registered ? 'locked' : 'unregistered');
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err instanceof Error ? err.message : i18n.t('trackfi.statusCheckFailed'));
        setState('error');
      });

    return () => {
      cancelled = true;
      stopTtlTicker();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken]);

  // ── unlock ────────────────────────────────────────────────────────────────

  const unlock = useCallback(async () => {
    setErrorMessage('');
    setState('unlocking');

    try {
      const dek = await authenticatePasskeyForDek();
      if (!dek) {
        // User cancelled the passkey dialog
        setState('locked');
        return;
      }
      // Bridge the DEK to the X25519 crypto session BEFORE unlocking, so
      // encrypted TrackFi data can actually be decrypted.
      await establishCryptoSession(dek);
      setDataKey(dek);
      dek.fill(0); // zero the local copy; session holds its own copy
      setState('unlocked');
      setUnlockSeq((s) => s + 1);
      setTtlMs(dataKeyTtlMs());
      startTtlTicker();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : i18n.t('trackfi.authError'));
      setState('error');
    }
  }, [startTtlTicker]);

  // ── register ──────────────────────────────────────────────────────────────

  const register = useCallback(async () => {
    setErrorMessage('');
    setState('unlocking'); // reuse spinner state during registration

    const displayName =
      userProfile.displayName || userProfile.email || 'Kura User';

    try {
      // registerPasskey generates the DEK during registration (via PRF extension)
      // and returns it directly — no second biometric prompt needed.
      const dek = await registerPasskey(displayName);
      if (!dek) {
        setState('unregistered');
        return;
      }
      await establishCryptoSession(dek);
      setDataKey(dek);
      dek.fill(0);
      setState('unlocked');
      setUnlockSeq((s) => s + 1);
      setTtlMs(dataKeyTtlMs());
      startTtlTicker();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : i18n.t('trackfi.registerError'));
      setState('error');
    }
  }, [userProfile.displayName, userProfile.email, startTtlTicker]);

  // ── lock ──────────────────────────────────────────────────────────────────

  const lock = useCallback(() => {
    clearDataKey();
    clearCryptoSession();
    stopTtlTicker();
    setTtlMs(0);
    setState('locked');
  }, [stopTtlTicker]);

  // ── reportLostPasskey ─────────────────────────────────────────────────────

  const reportLostPasskey = useCallback(() => {
    setErrorMessage('');
    setState('lost_passkey');
  }, []);

  // ── resetAndReregister ────────────────────────────────────────────────────

  const resetAndReregister = useCallback(async () => {
    setErrorMessage('');
    setState('resetting');

    const displayName =
      userProfile.displayName || userProfile.email || 'Kura User';

    try {
      // Step 1: wipe the E2EE layer on the server
      await resetE2EE();

      // Step 2: register a brand-new passkey on this device
      // (this also generates a fresh DEK via the PRF extension)
      const dek = await registerPasskey(displayName);
      if (!dek) {
        // User cancelled the passkey dialog — put them back at unregistered
        // (server-side reset already ran, so there is no passkey left)
        setState('unregistered');
        return;
      }

      // resetE2EE wiped the server keypair, so this establishes a fresh one.
      await establishCryptoSession(dek);
      setDataKey(dek);
      dek.fill(0);
      setState('unlocked');
      setUnlockSeq((s) => s + 1);
      setTtlMs(dataKeyTtlMs());
      startTtlTicker();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : i18n.t('trackfi.resetFailed'));
      // If reset ran but register failed, server has no passkey → unregistered
      // If reset itself failed, leave in error so user can retry
      setState('error');
    }
  }, [userProfile.displayName, userProfile.email, startTtlTicker]);

  return {
    state,
    errorMessage,
    isPasskeySupported,
    ttlMs,
    unlock,
    unlockSeq,
    register,
    lock,
    reportLostPasskey,
    resetAndReregister,
  };
}
