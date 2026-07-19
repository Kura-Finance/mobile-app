import { useEffect, useState } from 'react';
import { resolveBiometricAuthMethod, type BiometricAuthMethod } from '../../lib/security/biometricAuth';
import { useAppTranslation } from './useAppTranslation';
import { useAppStore } from '../store/useAppStore';

export const BIOMETRIC_LABEL_KEYS: Record<Exclude<BiometricAuthMethod, 'none'>, string> = {
  faceId: 'auth.useFaceId',
  touchId: 'auth.useTouchId',
  fingerprint: 'auth.useFingerprint',
};

export function biometricLabelForMethod(
  method: BiometricAuthMethod,
  t: (key: string) => string,
): string | null {
  if (method === 'none') return null;
  return t(BIOMETRIC_LABEL_KEYS[method]);
}

/**
 * Button label for the biometric unlock action when biometrics are available.
 */
export function useBiometricUnlockLabel(): string | null {
  const { t } = useAppTranslation();
  const biometricUnlockEnabled = useAppStore((state) => state.preferences.biometricUnlockEnabled);
  const [method, setMethod] = useState<BiometricAuthMethod>('none');

  useEffect(() => {
    if (!biometricUnlockEnabled) {
      setMethod('none');
      return;
    }

    let cancelled = false;
    void resolveBiometricAuthMethod().then((resolved) => {
      if (!cancelled) setMethod(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [biometricUnlockEnabled]);

  return biometricLabelForMethod(method, t);
}
