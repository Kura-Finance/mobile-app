import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EnterAppPinScreen from '../../features/auth/screens/EnterAppPinScreen';
import FaceIDScreen from '../../features/auth/screens/FaceIDScreen';
import SecurityOverlayShell from './SecurityOverlayShell';
import {
  cancelLocalAuth,
  clearLocalAuthBiometricError,
  clearLocalAuthPinError,
  getLocalAuthBiometricError,
  getLocalAuthBiometricMethod,
  getLocalAuthFaceIdSubtitleKey,
  getLocalAuthPhase,
  getLocalAuthPinError,
  getLocalAuthPinSubtitleKey,
  isLocalAuthBiometricsAvailable,
  isLocalAuthPending,
  localAuthPinErrorMessage,
  registerLocalAuthNotifier,
  submitLocalAuthBiometric,
  submitLocalAuthPin,
  switchLocalAuthToBiometric,
  switchLocalAuthToPin,
} from '../../lib/security/localAuthGate';
import { biometricLabelForMethod } from '../hooks/useDeviceAuthUnlockLabel';

/** Survives Strict Mode remounts so the auto biometric prompt only fires once per biometric phase entry. */
let localAuthAutoBiometricIssued = false;

/**
 * Local auth UI for sensitive in-app actions (send, withdraw, etc.).
 */
export default function LocalAuthOverlay() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(isLocalAuthPending());
  const [phase, setPhase] = useState(getLocalAuthPhase());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [subtitleKey, setSubtitleKey] = useState('auth.confirmAppPinSubtitle');
  const [faceIdSubtitleKey, setFaceIdSubtitleKey] = useState('auth.confirmBiometricSubtitle');
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState<string | null>(null);
  const biometricInFlightRef = useRef(false);

  const sync = useCallback(() => {
    setVisible(isLocalAuthPending());
    setPhase(getLocalAuthPhase());
    setSubtitleKey(getLocalAuthPinSubtitleKey());
    setFaceIdSubtitleKey(getLocalAuthFaceIdSubtitleKey());
    setBiometricsAvailable(isLocalAuthBiometricsAvailable());
    setBiometricLabel(biometricLabelForMethod(getLocalAuthBiometricMethod(), t));

    const pinError = getLocalAuthPinError();
    const biometricErr = getLocalAuthBiometricError();
    if (pinError) {
      setError(localAuthPinErrorMessage(pinError, t));
    } else if (biometricErr) {
      setError(t('card.biometricAuthFailed'));
    } else {
      setError('');
    }
  }, [t]);

  useEffect(() => registerLocalAuthNotifier(sync), [sync]);

  const handleCancel = useCallback(() => {
    clearLocalAuthPinError();
    clearLocalAuthBiometricError();
    cancelLocalAuth();
  }, []);

  const handleBiometric = useCallback(async () => {
    if (biometricInFlightRef.current) return;
    biometricInFlightRef.current = true;
    setSubmitting(true);
    clearLocalAuthBiometricError();
    setError('');
    try {
      await submitLocalAuthBiometric();
    } finally {
      biometricInFlightRef.current = false;
      setSubmitting(false);
    }
  }, []);

  const handlePinSubmit = useCallback(async (pin: string) => {
    setSubmitting(true);
    clearLocalAuthPinError();
    setError('');
    try {
      const ok = await submitLocalAuthPin(pin);
      if (!ok) {
        setError(localAuthPinErrorMessage(getLocalAuthPinError(), t));
      }
    } finally {
      setSubmitting(false);
    }
  }, [t]);

  useLayoutEffect(() => {
    if (!visible || phase !== 'biometric') {
      localAuthAutoBiometricIssued = false;
      return;
    }
    if (localAuthAutoBiometricIssued || !biometricsAvailable) {
      return;
    }
    localAuthAutoBiometricIssued = true;
    setSubmitting(true);
    void handleBiometric();
  }, [visible, phase, biometricsAvailable, handleBiometric]);

  if (!visible || !phase) {
    return null;
  }

  const interactionLocked = phase === 'biometric' && submitting;

  return (
    <SecurityOverlayShell
      onRequestClose={interactionLocked ? () => {} : handleCancel}
      interactionLocked={interactionLocked}
    >
      {phase === 'biometric' ? (
        <FaceIDScreen
          mode="overlay"
          error={error}
          unlocking={submitting}
          biometricsAvailable={biometricsAvailable}
          unlockLabel={biometricLabel ?? undefined}
          subtitleKey={faceIdSubtitleKey}
          onUnlock={() => void handleBiometric()}
          onEnterPin={() => {
            clearLocalAuthBiometricError();
            setError('');
            switchLocalAuthToPin();
          }}
          onCancel={handleCancel}
        />
      ) : (
        <EnterAppPinScreen
          mode="overlay"
          error={error}
          submitting={submitting}
          submitLabelKey="auth.confirmWithAppPin"
          subtitleKey={subtitleKey}
          onSubmit={handlePinSubmit}
          onCancel={biometricsAvailable ? () => {
            clearLocalAuthPinError();
            setError('');
            switchLocalAuthToBiometric();
          } : handleCancel}
          cancelUsesBiometricLabel={biometricsAvailable}
          biometricCancelLabel={biometricLabel ?? undefined}
        />
      )}
    </SecurityOverlayShell>
  );
}
