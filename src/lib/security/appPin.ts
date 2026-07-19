import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import * as Crypto from 'expo-crypto';
import {
  createPinHash as createPinHashCore,
  verifyPin as verifyPinCore,
  type AppPinHashRecord,
  type AppPinVerifyResult,
} from './appPinCore';
import { isPinLockedOut, recordPinFailure, resetPinAttempts } from './appPinRateLimit';
import {
  clearAppPinHash,
  hasAppPinHash,
  loadAppPinHash,
  saveAppPinHash,
} from './appPinStore';

export type { AppPinFailureReason, AppPinVerifyResult } from './appPinCore';
export { APP_PIN_LENGTH, isValidPinFormat, pinsMatch } from './appPinCore';

/** Sync iterated SHA-256 — faster than 10k async expo-crypto round-trips. */
const PIN_HASH_ITERATIONS = 10_000;

function randomSaltHex(): string {
  return bytesToHex(Crypto.getRandomBytes(16));
}

function sha256Hex(input: string): string {
  return bytesToHex(sha256(utf8ToBytes(input)));
}

async function hashPinV1(pin: string, salt: string): Promise<string> {
  return sha256Hex(`${salt}:${pin}`);
}

async function hashPinV2(pin: string, salt: string): Promise<string> {
  let digest = `${salt}:${pin}`;
  for (let i = 0; i < PIN_HASH_ITERATIONS; i += 1) {
    digest = sha256Hex(digest);
  }
  return digest;
}

const hashDeps = {
  generateSalt: randomSaltHex,
  hashPin: hashPinV1,
  hashPinV2: hashPinV2,
};

async function upgradePinHashIfNeeded(pin: string, record: AppPinHashRecord): Promise<void> {
  if ((record.version ?? 1) >= 2) return;
  const upgraded = await createPinHashCore(pin, hashDeps);
  await saveAppPinHash(upgraded);
}

export async function hasAppPin(): Promise<boolean> {
  return hasAppPinHash();
}

export async function setAppPin(pin: string): Promise<void> {
  const record = await createPinHashCore(pin, hashDeps);
  await saveAppPinHash(record);
  resetPinAttempts();
}

export async function verifyAppPin(pin: string): Promise<AppPinVerifyResult> {
  if (isPinLockedOut()) {
    return { ok: false, reason: 'locked_out' };
  }

  const record = await loadAppPinHash();
  const result = await verifyPinCore(pin, record, hashDeps);

  if (result.ok) {
    resetPinAttempts();
    if (record) {
      await upgradePinHashIfNeeded(pin, record);
    }
    return result;
  }

  if (result.reason === 'wrong_pin') {
    recordPinFailure();
  }
  return result;
}

export async function changeAppPin(currentPin: string, newPin: string): Promise<AppPinVerifyResult> {
  const verified = await verifyAppPin(currentPin);
  if (!verified.ok) return verified;
  await setAppPin(newPin);
  return { ok: true };
}

export async function clearAppPin(): Promise<void> {
  await clearAppPinHash();
  resetPinAttempts();
}

export async function loadStoredPinHash(): Promise<AppPinHashRecord | null> {
  return loadAppPinHash();
}
