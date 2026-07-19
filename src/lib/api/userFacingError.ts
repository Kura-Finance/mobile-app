/**
 * Maps API / network errors to localized, user-safe messages.
 * Never surfaces raw server strings (e.g. "Too many Request") in the UI.
 */
import i18n from '../../shared/locales/i18n';
import { KuraApiError, KuraNetworkError } from './errors';

const CLIENT_PASSKEY_HINTS = [
  'PRF extension',
  'Passkeys are not supported',
  'Passkeys with PRF require',
  'passkey may already exist',
  'Changed device or lost passkey',
  'Failed to decrypt your account key',
  'Unexpected encryptedDek length',
  'XOR length mismatch',
  'Biometrics must be enabled',
  'Passkey request',
  'passkey authorization failed',
  'not properly configured',
  'not supported on this',
  'InvalidChallenge',
  'InvalidUserId',
  'InvalidPRF',
  'UnknownException',
  'NotSupportedException',
  'BiometricException',
  'PasskeyRequestFailed',
  'PasskeyAuthorizationFailed',
  'NotConfiguredException',
];

function isClientPasskeyMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return CLIENT_PASSKEY_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
}

function extractErrorDetail(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error === 'object') {
    const o = error as { message?: unknown; name?: unknown; code?: unknown };
    if (typeof o.message === 'string' && o.message.trim()) return o.message.trim();
    if (typeof o.name === 'string' && o.name.trim()) return o.name.trim();
    if (typeof o.code === 'string' && o.code.trim()) return o.code.trim();
  }
  return '';
}

/**
 * @param fallbackKey i18n key used for generic / server-side failures
 */
export function userFacingApiError(error: unknown, fallbackKey: string): string {
  if (error instanceof KuraApiError) {
    if (error.isRateLimited()) {
      return i18n.t('trackfi.rateLimitError');
    }
    if (error.isUnauthorized()) {
      return i18n.t('errors.unauthorized');
    }
    if (error.status >= 500) {
      return i18n.t('errors.serverError');
    }
    return i18n.t(fallbackKey);
  }

  if (error instanceof KuraNetworkError) {
    return i18n.t('errors.networkError');
  }

  const detail = extractErrorDetail(error);
  if (detail && isClientPasskeyMessage(detail)) {
    return detail;
  }

  // Expo native exceptions often carry a useful message even when not in the allowlist.
  // Prefer a localized fallback, but never return an empty string.
  const fallback = i18n.t(fallbackKey);
  if (detail && fallbackKey.startsWith('trackfi.')) {
    return `${fallback}${fallback.endsWith('.') ? '' : '.'} ${detail}`.trim();
  }
  return fallback || detail || i18n.t('trackfi.registerError');
}
