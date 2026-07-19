import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePrivy } from '@privy-io/expo';
import { useAppStore } from '../store/useAppStore';
import { useSessionUsable } from '../../lib/security/sessionAccess';
import SetAppPinScreen from '../../features/auth/screens/SetAppPinScreen';
import SecurityOverlayShell from './SecurityOverlayShell';
import { appPinSetupFailureMessage } from '../../lib/security/authErrorMessages';

/**
 * Blocks the app until the user creates a mandatory App PIN after sign-in.
 */
export default function AppPinSetupOverlay() {
  const { t } = useTranslation();
  const { logout } = usePrivy();
  const sessionUsable = useSessionUsable();
  const appPinEnabled = useAppStore((s) => s.appPinEnabled);
  const saveAppPin = useAppStore((s) => s.saveAppPin);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionUsable) {
      setDismissed(false);
    }
  }, [sessionUsable]);

  const visible = sessionUsable && !appPinEnabled && !dismissed;

  const handleSubmit = useCallback(
    async (pin: string) => {
      if (!mountedRef.current) return;
      setSubmitting(true);
      setError('');
      try {
        const result = await saveAppPin(pin);
        if (!mountedRef.current) return;
        if (!result.ok) {
          setError(appPinSetupFailureMessage(result.reason ?? 'failed', t));
          return;
        }
        Keyboard.dismiss();
        // Dismiss locally before tearing down FullWindowOverlay to avoid iOS crashes.
        setDismissed(true);
      } finally {
        if (mountedRef.current) {
          setSubmitting(false);
        }
      }
    },
    [saveAppPin, t],
  );

  if (!visible) {
    return null;
  }

  return (
    <SecurityOverlayShell onRequestClose={() => void logout()}>
      <SetAppPinScreen
        mode="overlay"
        required
        submitting={submitting}
        error={error}
        showBack={false}
        onSubmit={(pin) => handleSubmit(pin)}
        onCancel={() => void logout()}
      />
    </SecurityOverlayShell>
  );
}
