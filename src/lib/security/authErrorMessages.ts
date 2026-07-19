import type { AppPinFailureReason } from './appPinCore';
import type { BiometricAuthFailureReason } from './biometricAuthCore';

export function biometricFailureMessage(
  reason: BiometricAuthFailureReason,
  t: (key: string) => string,
): string {
  switch (reason) {
    case 'not_supported':
      return t('settings.biometricNotSupported');
    case 'not_enrolled':
      return t('settings.biometricNotAvailable');
    default:
      return t('auth.biometricUnlockFailed');
  }
}

/** PIN / unlock failure reasons surfaced by AppStore unlock helpers. */
export type PinOrUnlockFailureReason =
  | AppPinFailureReason
  | BiometricAuthFailureReason
  | 'failed';

export function appPinSetupFailureMessage(
  reason: PinOrUnlockFailureReason,
  t: (key: string) => string,
): string {
  if (reason === 'failed') return t('auth.appPinSaveFailed');
  return appPinFailureMessage(reason, t);
}

export function appPinFailureMessage(
  reason: PinOrUnlockFailureReason,
  t: (key: string) => string,
): string {
  switch (reason) {
    case 'wrong_pin':
      return t('auth.appPinWrong');
    case 'invalid_format':
    case 'mismatch':
      return t('auth.appPinInvalid');
    case 'locked_out':
      return t('auth.appPinLockedOut');
    case 'no_pin_set':
      return t('settings.appPinRequired');
    case 'not_supported':
      return t('settings.biometricNotSupported');
    case 'not_enrolled':
      return t('settings.biometricNotAvailable');
    default:
      return t('auth.biometricUnlockFailed');
  }
}

export function localAuthFailureMessage(
  code: string | undefined,
  t: (key: string) => string,
): string | undefined {
  switch (code as BiometricAuthFailureReason | AppPinFailureReason | 'no_pin_set' | 'auth_in_progress' | undefined) {
    case 'cancelled':
      return undefined;
    case 'auth_in_progress':
      return t('auth.localAuthInProgress');
    case 'not_supported':
      return t('settings.biometricNotSupported');
    case 'not_enrolled':
    case 'no_pin_set':
      return t('settings.appPinRequired');
    case 'wrong_pin':
      return t('auth.appPinWrong');
    case 'invalid_format':
      return t('auth.appPinInvalid');
    case 'locked_out':
      return t('auth.appPinLockedOut');
    default:
      return code ? t('card.biometricAuthFailed') : undefined;
  }
}

export function localAuthPinErrorMessage(
  reason: AppPinFailureReason | 'failed' | null,
  t: (key: string) => string,
): string {
  return localAuthFailureMessage(reason ?? 'failed', t) ?? t('card.biometricAuthFailed');
}
