/**
 * Mask sensitive fields so they never reach Logger / DevTools / Sentry / console.
 *
 * Anything with these keys (case-insensitive) is replaced with '<redacted:len=N>'.
 * Caller is responsible for using this on every object that may contain such data
 * before logging.
 */

const REDACT_KEYS = new Set(
  [
    'authorization',
    'cookie',
    'set-cookie',
    'token',
    'authToken',
    'access_token',
    'accessToken',
    'refresh_token',
    'refreshToken',
    'password',
    'newPassword',
    'oldPassword',
    'verificationCode',
    'code',
    'resetCode',
    'srpVerifier',
    'clientM1',
    'serverM2',
    'authKeyHex',
    'privateKey',
    'encryptedPrivateKey',
    'wrappedSek',
    'sek',
    'payloadCiphertext',
    'apiKey',
    'apiSecret',
    'passphrase',
    'avatar',
    'data:image',
  ].map((k) => k.toLowerCase()),
);

const REDACT_PATTERN = /^(eyJ[a-zA-Z0-9_-]{20,}|Bearer\s+\S+|sk_[a-zA-Z0-9_-]{16,}|pk_[a-zA-Z0-9_-]{16,})/;

function redactString(value: string): string {
  if (REDACT_PATTERN.test(value.trim())) {
    return `<redacted:str:len=${value.length}>`;
  }
  return value;
}

function redactValue(value: unknown, depth: number): unknown {
  if (depth > 6) return '<redacted:depth>';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return redactString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;

  if (value instanceof Uint8Array) {
    return `<redacted:bytes:len=${value.byteLength}>`;
  }
  if (value instanceof ArrayBuffer) {
    return `<redacted:buffer:len=${value.byteLength}>`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(key.toLowerCase())) {
        if (typeof raw === 'string') {
          out[key] = `<redacted:len=${raw.length}>`;
        } else if (raw instanceof Uint8Array) {
          out[key] = `<redacted:bytes:len=${raw.byteLength}>`;
        } else {
          out[key] = '<redacted>';
        }
      } else {
        out[key] = redactValue(raw, depth + 1);
      }
    }
    return out;
  }

  return value;
}

export function safeRedact<T = unknown>(value: T): unknown {
  return redactValue(value, 0);
}

export function safeHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (REDACT_KEYS.has(key.toLowerCase())) {
      out[key] = `<redacted:len=${value.length}>`;
    } else {
      out[key] = value;
    }
  });
  return out;
}
