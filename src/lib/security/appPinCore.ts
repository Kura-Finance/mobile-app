export const APP_PIN_LENGTH = 6;

export type AppPinFailureReason =
  | 'invalid_format'
  | 'mismatch'
  | 'wrong_pin'
  | 'no_pin_set'
  | 'locked_out';

export type AppPinVerifyResult =
  | { ok: true }
  | { ok: false; reason: AppPinFailureReason };

export interface AppPinHashRecord {
  salt: string;
  hash: string;
  /** 1 = single SHA256 (legacy), 2 = iterated SHA256. */
  version?: 1 | 2;
}

export interface AppPinHashDeps {
  hashPin: (pin: string, salt: string) => Promise<string>;
  hashPinV2?: (pin: string, salt: string) => Promise<string>;
  generateSalt: () => string;
}

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${APP_PIN_LENGTH}}$`).test(pin);
}

export function pinsMatch(pin: string, confirmPin: string): boolean {
  return pin === confirmPin;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function createPinHash(
  pin: string,
  deps: AppPinHashDeps,
): Promise<AppPinHashRecord> {
  if (!isValidPinFormat(pin)) {
    throw new Error('invalid_pin_format');
  }
  const salt = deps.generateSalt();
  const hash = deps.hashPinV2
    ? await deps.hashPinV2(pin, salt)
    : await deps.hashPin(pin, salt);
  return { salt, hash, version: deps.hashPinV2 ? 2 : 1 };
}

export async function verifyPin(
  pin: string,
  record: AppPinHashRecord | null,
  deps: Pick<AppPinHashDeps, 'hashPin'> & { hashPinV2?: (pin: string, salt: string) => Promise<string> },
): Promise<AppPinVerifyResult> {
  if (!record) {
    return { ok: false, reason: 'no_pin_set' };
  }
  if (!isValidPinFormat(pin)) {
    return { ok: false, reason: 'invalid_format' };
  }
  const version = record.version ?? 1;
  const hash =
    version === 2 && deps.hashPinV2
      ? await deps.hashPinV2(pin, record.salt)
      : await deps.hashPin(pin, record.salt);
  if (timingSafeEqual(hash, record.hash)) {
    return { ok: true };
  }
  return { ok: false, reason: 'wrong_pin' };
}
