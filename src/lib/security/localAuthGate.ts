import { hasAppPin, verifyAppPin } from './appPin';
import { authenticateWithBiometrics, hasBiometricUnlock, resolveBiometricAuthMethod } from './biometricAuth';
import type { AppPinFailureReason } from './appPinCore';
import type { BiometricAuthFailureReason, BiometricAuthMethod } from './biometricAuthCore';

export type LocalAuthGateResult =
  | { allowed: true }
  | { allowed: false; message?: string; cancelled?: boolean };

export type LocalAuthPhase = 'biometric' | 'pin';

type PendingLocalAuth = {
  resolve: (result: LocalAuthGateResult) => void;
  promptText: string;
  promptKey?: string;
  phase: LocalAuthPhase;
  pinSubtitleKey: string;
  faceIdSubtitleKey: string;
  biometricsAvailable: boolean;
  biometricMethod: BiometricAuthMethod;
};

let pending: PendingLocalAuth | null = null;
let pinError: AppPinFailureReason | 'failed' | null = null;
let biometricError: 'failed' | null = null;
const listeners = new Set<() => void>();

export function registerLocalAuthNotifier(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function isLocalAuthPending(): boolean {
  return pending != null;
}

export function getLocalAuthPhase(): LocalAuthPhase | null {
  return pending?.phase ?? null;
}

export function getLocalAuthPinError(): AppPinFailureReason | 'failed' | null {
  return pinError;
}

export function getLocalAuthBiometricError(): 'failed' | null {
  return biometricError;
}

export function clearLocalAuthPinError(): void {
  pinError = null;
  notify();
}

export function clearLocalAuthBiometricError(): void {
  biometricError = null;
  notify();
}

export function getLocalAuthPinSubtitleKey(): string {
  return pending?.pinSubtitleKey ?? 'auth.confirmAppPinSubtitle';
}

export function getLocalAuthFaceIdSubtitleKey(): string {
  return pending?.faceIdSubtitleKey ?? 'auth.confirmBiometricSubtitle';
}

export function isLocalAuthBiometricsAvailable(): boolean {
  return pending?.biometricsAvailable ?? false;
}

export function getLocalAuthBiometricMethod(): BiometricAuthMethod {
  return pending?.biometricMethod ?? 'none';
}

function resolvePinSubtitleKey(promptKey?: string): string {
  switch (promptKey) {
    case 'card.biometricSendPrompt':
      return 'auth.confirmAppPinSendSubtitle';
    case 'card.biometricWithdrawPrompt':
      return 'auth.confirmAppPinWithdrawSubtitle';
    case 'walletConnect.biometricSignPrompt':
      return 'auth.confirmAppPinWalletConnectSubtitle';
    default:
      return 'auth.confirmAppPinSubtitle';
  }
}

function resolveFaceIdSubtitleKey(promptKey?: string): string {
  switch (promptKey) {
    case 'card.biometricSendPrompt':
      return 'auth.biometricSendSubtitle';
    case 'card.biometricWithdrawPrompt':
      return 'auth.biometricWithdrawSubtitle';
    case 'walletConnect.biometricSignPrompt':
      return 'auth.biometricWalletConnectSubtitle';
    default:
      return 'auth.confirmBiometricSubtitle';
  }
}

function shouldFallbackToPin(reason: BiometricAuthFailureReason): boolean {
  return (
    reason === 'cancelled' ||
    reason === 'failed' ||
    reason === 'not_enrolled' ||
    reason === 'not_supported'
  );
}

function resolvePending(result: LocalAuthGateResult): void {
  const current = pending;
  pending = null;
  pinError = null;
  biometricError = null;
  current?.resolve(result);
  notify();
}

function waitForLocalAuth(
  phase: LocalAuthPhase,
  promptText: string,
  promptKey: string | undefined,
  biometricsAvailable: boolean,
  biometricMethod: BiometricAuthMethod,
): Promise<LocalAuthGateResult> {
  return new Promise((resolve) => {
    pinError = null;
    biometricError = null;
    pending = {
      resolve,
      promptText,
      promptKey,
      phase,
      pinSubtitleKey: resolvePinSubtitleKey(promptKey),
      faceIdSubtitleKey: resolveFaceIdSubtitleKey(promptKey),
      biometricsAvailable,
      biometricMethod,
    };
    notify();
  });
}

/**
 * Require local authentication for a sensitive action.
 * Shows in-app biometric UI when available; otherwise falls back to App PIN entry.
 */
export async function requireLocalAuth(
  promptText: string,
  promptKey?: string,
): Promise<LocalAuthGateResult> {
  if (pending) {
    return { allowed: false, message: 'auth_in_progress' };
  }

  if (!(await hasAppPin())) {
    return { allowed: false, message: 'no_pin_set' };
  }

  const biometricsAvailable = await hasBiometricUnlock();
  if (biometricsAvailable) {
    const method = await resolveBiometricAuthMethod();
    return waitForLocalAuth('biometric', promptText, promptKey, true, method);
  }

  return waitForLocalAuth('pin', promptText, promptKey, false, 'none');
}

export function switchLocalAuthToPin(): void {
  if (!pending) return;
  pending.phase = 'pin';
  pinError = null;
  biometricError = null;
  notify();
}

export function switchLocalAuthToBiometric(): void {
  if (!pending?.biometricsAvailable) return;
  pending.phase = 'biometric';
  pinError = null;
  biometricError = null;
  notify();
}

export async function submitLocalAuthBiometric(): Promise<boolean> {
  if (!pending || pending.phase !== 'biometric') return false;

  biometricError = null;
  const biometric = await authenticateWithBiometrics(pending.promptText);
  if (biometric.ok) {
    resolvePending({ allowed: true });
    return true;
  }

  if (!shouldFallbackToPin(biometric.reason)) {
    resolvePending({ allowed: false, message: biometric.reason });
    return true;
  }

  if (biometric.reason !== 'cancelled') {
    biometricError = 'failed';
  }
  notify();
  return false;
}

export async function submitLocalAuthPin(pin: string): Promise<boolean> {
  if (!pending || pending.phase !== 'pin') return false;

  const verified = await verifyAppPin(pin);
  if (!verified.ok) {
    pinError = verified.reason;
    notify();
    return false;
  }

  resolvePending({ allowed: true });
  return true;
}

export function cancelLocalAuth(): void {
  if (!pending) return;
  resolvePending({ allowed: false, cancelled: true });
}

/** Dismiss PIN UI when the session lock overlay takes over. */
export function cancelLocalAuthForSessionLock(): void {
  cancelLocalAuth();
}

export {
  localAuthFailureMessage,
  localAuthPinErrorMessage,
} from './authErrorMessages';
