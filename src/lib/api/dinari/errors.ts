import { KuraApiError } from '../errors';

/** Dinari endpoints return 403 when the user is not on the product whitelist. */
export function isDinariWhitelistError(error: unknown): boolean {
  if (!(error instanceof KuraApiError) || error.status !== 403) return false;
  const haystack = `${error.code} ${error.message}`.toLowerCase();
  return haystack.includes('whitelist') || haystack.includes('not_on_whitelist');
}

/** 403 from wallet/nonce when KYC has not passed (distinct from whitelist). */
export function isDinariKycRequiredError(error: unknown): boolean {
  if (!(error instanceof KuraApiError) || error.status !== 403) return false;
  return !isDinariWhitelistError(error);
}

/** 400 when walletAddress does not match the registered SCA. */
export function isDinariWalletMismatchError(error: unknown): boolean {
  if (!(error instanceof KuraApiError) || error.status !== 400) return false;
  const haystack = `${error.code} ${error.message}`.toLowerCase();
  return (
    haystack.includes('wallet')
    || haystack.includes('sca')
    || haystack.includes('address')
  );
}

/** 409 when the Dinari account does not exist in the current sandbox/environment. */
export function isDinariAccountEnvMismatchError(error: unknown): boolean {
  if (!(error instanceof KuraApiError) || error.status !== 409) return false;
  const haystack = `${error.code} ${error.message}`.toLowerCase();
  return (
    haystack.includes('account')
    || haystack.includes('environment')
    || haystack.includes('sandbox')
    || haystack.includes('dinari')
  );
}

function readFieldErrors(details: unknown): unknown[] {
  if (!details || typeof details !== 'object') return [];

  const root = details as Record<string, unknown>;
  if (Array.isArray(root.field_errors)) return root.field_errors;

  const nested = root.error;
  if (nested && typeof nested === 'object') {
    const fieldErrors = (nested as Record<string, unknown>).field_errors;
    if (Array.isArray(fieldErrors)) return fieldErrors;
  }

  return [];
}

function stringifyFieldError(entry: unknown): string {
  if (typeof entry === 'string') return entry;
  if (!entry || typeof entry !== 'object') return String(entry);

  const obj = entry as Record<string, unknown>;
  const field = typeof obj.field === 'string' ? obj.field : undefined;
  const message = typeof obj.message === 'string'
    ? obj.message
    : typeof obj.msg === 'string'
      ? obj.msg
      : undefined;

  if (field && message) return `${field}: ${message}`;
  if (message) return message;
  try {
    return JSON.stringify(entry);
  } catch {
    return String(entry);
  }
}

function extractErrorIdFromMessage(message: string): string | undefined {
  const match = message.match(/error_id=([^\s,;]+)/i);
  return match?.[1];
}

function extractErrorId(details: unknown, message?: string): string | undefined {
  if (details && typeof details === 'object') {
    const root = details as Record<string, unknown>;
    if (typeof root.error_id === 'string') return root.error_id;
    const nested = root.error;
    if (nested && typeof nested === 'object') {
      const id = (nested as Record<string, unknown>).error_id;
      if (typeof id === 'string') return id;
    }
  }
  if (message) return extractErrorIdFromMessage(message);
  return undefined;
}

/** Expand nested field_errors for Logger / debug panel (avoids `[Array]` in RN logs). */
export function formatDinariErrorForLog(error: unknown): Record<string, unknown> {
  if (!(error instanceof KuraApiError)) {
    return { message: error instanceof Error ? error.message : String(error) };
  }

  const fieldErrors = readFieldErrors(error.details).map(stringifyFieldError);
  const errorId = extractErrorId(error.details, error.message);

  return {
    status: error.status,
    code: error.code,
    message: error.message,
    fieldErrors: fieldErrors.length ? fieldErrors : undefined,
    errorId,
  };
}

/** User-visible message for wallet connect failures. Prefers backend message + field_errors. */
export function getDinariConnectErrorMessage(error: unknown): string {
  if (!(error instanceof KuraApiError)) {
    return error instanceof Error ? error.message : 'Failed to connect wallet to Dinari.';
  }

  const fieldErrors = readFieldErrors(error.details).map(stringifyFieldError);
  const errorId = extractErrorId(error.details, error.message);
  const fieldSuffix = fieldErrors.length ? ` (${fieldErrors.join('; ')})` : '';
  const errorIdSuffix = errorId ? ` (error_id: ${errorId})` : '';

  if (isDinariKycRequiredError(error)) {
    return `Complete Dinari identity verification before connecting your wallet.${fieldSuffix || errorIdSuffix}`;
  }
  if (isDinariWalletMismatchError(error)) {
    return (error.message || 'Wallet address does not match your registered smart account.') + (fieldSuffix || errorIdSuffix);
  }
  if (isDinariAccountEnvMismatchError(error)) {
    return (error.message || 'Dinari account is out of sync with this environment.') + (fieldSuffix || errorIdSuffix);
  }

  if (error.status === 422) {
    const hint = 'Ensure KYC has passed and your smart account matches PATCH /api/wallet/sca.';
    if (fieldSuffix) {
      return `Dinari could not issue a wallet nonce.${fieldSuffix}`;
    }
    if (errorIdSuffix) {
      return `Dinari could not issue a wallet nonce. ${hint}${errorIdSuffix}`;
    }
  }

  return (error.message || 'Failed to connect wallet to Dinari.') + (fieldSuffix || errorIdSuffix);
}
