import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePrivy } from '@privy-io/expo';
import { useAppStore } from '../store/useAppStore';
import FaceIDScreen from '../../features/auth/screens/FaceIDScreen';
import EnterAppPinScreen from '../../features/auth/screens/EnterAppPinScreen';
import SetAppPinScreen from '../../features/auth/screens/SetAppPinScreen';
import { clearAppPin } from '../../lib/security/appPin';
import { resolveBiometricAuthMethod } from '../../lib/security/biometricAuth';
import type { BiometricAuthMethod, BiometricAuthFailureReason } from '../../lib/security/biometricAuthCore';
import { appPinFailureMessage, biometricFailureMessage } from '../../lib/security/authErrorMessages';
import { biometricLabelForMethod } from '../../shared/hooks/useDeviceAuthUnlockLabel';
import SecurityOverlayShell from './SecurityOverlayShell';

type LockView = 'welcome' | 'enterPin' | 'setPin';

/** Survives Strict Mode remounts so the auto biometric prompt only fires once per lock. */
let sessionLockAutoBiometricIssued = false;

export default function SessionLockOverlay() {
  const { t } = useTranslation();
  const { logout } = usePrivy();
  const sessionLockStatus = useAppStore((s) => s.sessionLockStatus);
  const appPinEnabled = useAppStore((s) => s.appPinEnabled);
  const biometricUnlockEnabled = useAppStore((s) => s.preferences.biometricUnlockEnabled);
  const unlockSession = useAppStore((s) => s.unlockSession);
  const unlockSessionWithAppPin = useAppStore((s) => s.unlockSessionWithAppPin);
  const saveAppPin = useAppStore((s) => s.saveAppPin);
  const refreshAppPinStatus = useAppStore((s) => s.refreshAppPinStatus);
  const [view, setView] = useState<LockView>('welcome');
  const [error, setError] = useState('');
  const [unlocking, setUnlocking] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricMethod, setBiometricMethod] = useState<BiometricAuthMethod>('none');
  const probeGenerationRef = useRef(0);
  const biometricUnlockInFlightRef = useRef(false);

  const visible = sessionLockStatus === 'locked';

  const tryBiometricUnlock = useCallback(async () => {
    if (!biometricUnlockEnabled || biometricUnlockInFlightRef.current) return;
    biometricUnlockInFlightRef.current = true;
    setUnlocking(true);
    setError('');
    try {
      const result = await unlockSession(t('auth.biometricUnlockPrompt'));
      if (result.ok) return;
      if (result.reason !== 'cancelled') {
        setError(biometricFailureMessage(result.reason as BiometricAuthFailureReason, t));
      }
    } finally {
      biometricUnlockInFlightRef.current = false;
      setUnlocking(false);
    }
  }, [biometricUnlockEnabled, t, unlockSession]);

  const tryPinUnlock = useCallback(
    async (pin: string) => {
      setUnlocking(true);
      setError('');
      try {
        const result = await unlockSessionWithAppPin(pin);
        if (result.ok) return;
        setError(appPinFailureMessage(result.reason ?? 'failed', t));
      } finally {
        setUnlocking(false);
      }
    },
    [t, unlockSessionWithAppPin],
  );

  const handleSavePin = useCallback(
    async (pin: string) => {
      setUnlocking(true);
      setError('');
      try {
        const saved = await saveAppPin(pin);
        if (!saved.ok) {
          setError(appPinFailureMessage(saved.reason ?? 'failed', t));
          return;
        }
        const unlocked = await unlockSessionWithAppPin(pin);
        if (!unlocked.ok) {
          setView('enterPin');
          setError(appPinFailureMessage(unlocked.reason ?? 'failed', t));
        }
      } catch (err) {
        setError(appPinFailureMessage('failed', t));
      } finally {
        setUnlocking(false);
      }
    },
    [saveAppPin, t, unlockSessionWithAppPin],
  );

  const handleForgotPin = useCallback(async () => {
    await clearAppPin();
    await refreshAppPinStatus();
    void logout();
  }, [logout, refreshAppPinStatus]);

  useEffect(() => {
    const generation = ++probeGenerationRef.current;

    if (!visible) {
      sessionLockAutoBiometricIssued = false;
      setView('welcome');
      setError('');
      setBiometricsAvailable(false);
      return;
    }

    if (!appPinEnabled) {
      setBiometricsAvailable(false);
      setView('setPin');
      return;
    }

    if (!biometricUnlockEnabled) {
      setBiometricsAvailable(false);
      setView('enterPin');
      return;
    }

    setBiometricsAvailable(false);
    setBiometricMethod('none');
    void resolveBiometricAuthMethod().then((method) => {
      if (probeGenerationRef.current !== generation) return;
      const available = method !== 'none';
      setBiometricMethod(method);
      setBiometricsAvailable(available);
      setView(available ? 'welcome' : 'enterPin');
    });
  }, [visible, appPinEnabled, biometricUnlockEnabled]);

  const biometricLabel = biometricLabelForMethod(biometricMethod, t);

  useLayoutEffect(() => {
    if (
      !visible
      || sessionLockAutoBiometricIssued
      || !appPinEnabled
      || !biometricsAvailable
    ) {
      return;
    }
    sessionLockAutoBiometricIssued = true;
    setUnlocking(true);
    void tryBiometricUnlock();
  }, [visible, appPinEnabled, biometricsAvailable, tryBiometricUnlock]);

  if (!visible) {
    return null;
  }

  const interactionLocked = view === 'welcome' && unlocking;

  return (
    <SecurityOverlayShell interactionLocked={interactionLocked}>
      {view === 'welcome' ? (
        <FaceIDScreen
          mode="overlay"
          brandLayout
          error={error}
          unlocking={unlocking}
          biometricsAvailable={biometricsAvailable}
          unlockLabel={biometricLabel}
          subtitleKey="auth.welcomeBack"
          onUnlock={() => void tryBiometricUnlock()}
          onEnterPin={() => {
            setError('');
            setView('enterPin');
          }}
          onLogOut={() => void logout()}
        />
      ) : null}

      {view === 'enterPin' ? (
        <EnterAppPinScreen
          mode="overlay"
          error={error}
          submitting={unlocking}
          showForgotPin
          onSubmit={(pin) => tryPinUnlock(pin)}
          onCancel={biometricsAvailable ? () => {
            setError('');
            setView('welcome');
          } : undefined}
          cancelUsesBiometricLabel
          biometricCancelLabel={biometricLabel}
          onForgotPin={() => void handleForgotPin()}
        />
      ) : null}

      {view === 'setPin' ? (
        <SetAppPinScreen
          mode="overlay"
          required
          submitting={unlocking}
          error={error}
          showBack={false}
          onSubmit={(pin) => handleSavePin(pin)}
          onCancel={() => void logout()}
        />
      ) : null}
    </SecurityOverlayShell>
  );
}
