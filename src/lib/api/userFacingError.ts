/**
 * Maps API / network errors to localized, user-safe messages.
 * Never surfaces raw server strings (e.g. "Too many Request") in the UI.
 */
import i18n from '../../shared/locales/i18n';
import { KuraApiError, KuraNetworkError } from './errors';

const CLIENT_PASSKEY_HINTS = [
  'PRF extension',
  'Passkeys are not supported',
  'Failed to decrypt your account key',
  'Unexpected encryptedDek length',
];

function isClientPasskeyMessage(message: string): boolean {
  return CLIENT_PASSKEY_HINTS.some((hint) => message.includes(hint));
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

  if (error instanceof Error) {
    if (isClientPasskeyMessage(error.message)) {
      return error.message;
    }
    return i18n.t(fallbackKey);
  }

  return i18n.t(fallbackKey);
}
