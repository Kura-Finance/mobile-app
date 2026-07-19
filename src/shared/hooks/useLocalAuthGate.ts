import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  localAuthFailureMessage,
  requireLocalAuth,
} from '../../lib/security/localAuthGate';

type GateResult = { allowed: true } | { allowed: false; message?: string };

/**
 * Gate sensitive actions behind local auth (biometrics when available, App PIN fallback).
 */
export function useLocalAuthGate() {
  const { t } = useTranslation();

  const requireLocalAuthForAction = useCallback(
    async (promptKey: string): Promise<GateResult> => {
      const result = await requireLocalAuth(t(promptKey), promptKey);
      if (result.allowed) {
        return { allowed: true };
      }
      return {
        allowed: false,
        message: localAuthFailureMessage(result.message, t),
      };
    },
    [t],
  );

  return { requireLocalAuth: requireLocalAuthForAction };
}

/** @deprecated Use useLocalAuthGate instead. */
export function useBiometricTransactionGate() {
  return useLocalAuthGate();
}
