/**
 * E2EE keypair lifecycle — bridges the Passkey DEK to the in-memory
 * {@link CryptoSession} that {@link requireCryptoSession} (and therefore the
 * envelope decryptor) depends on.
 *
 * Without this bridge, TrackFi unlock only loads the DEK into
 * `dataKeySession`, but `envelope.ts` reads the X25519 private key from
 * `session.ts` — which stays empty, producing the recurring
 * "No active crypto session" failures during Plaid / asset-history hydration.
 *
 * ─── Key model ──────────────────────────────────────────────────────────────
 *   - DEK            : 32-byte high-entropy key recovered via the Passkey PRF
 *                      (see passkeyService). Used here as the KEK (no KDF needed).
 *   - X25519 keypair : per-user; the private key is wrapped with the DEK and
 *                      stored server-side as the opaque `encryptedPrivateKey`.
 *                      The public key is what the backend seals each row's SEK to.
 *
 *   encryptedPrivateKey = base64( iv(12) || ciphertext || tag(16) )   // AES-256-GCM
 *
 * ─── Anti-orphan flow ───────────────────────────────────────────────────────
 *   1. GET /api/auth/keys/me
 *        200 → unwrap encryptedPrivateKey with the DEK → private key
 *        404 → no keypair yet → generate one, wrap, POST /setup
 *   2. On a 409 during setup (race / stale 404) → re-GET and unwrap.
 *   Never POST without GETting first, so an existing keypair is never orphaned.
 */

import {
  fetchMyKeyPair,
  isKeyPairAlreadyConfigured,
  setupKeyPair,
} from '../api/auth/keys';
import type { UserKeyPairRecord } from '../api/auth/schemas';
import Logger from '../../shared/utils/Logger';
import { aesGcmDecrypt, aesGcmSeal, unpackIvCtTag } from './aesgcm';
import { base64ToBytes, bytesToBase64, zeroize } from './encoding';
import { randomBytes } from './random';
import { setCryptoSession } from './session';
import {
  generateX25519KeyPair,
  x25519PublicFromPrivate,
  X25519_KEY_BYTES,
} from './x25519';

const TAG = 'KeypairManager';

/** Wrap a raw X25519 private key with the DEK → `iv | ct | tag`, base64. */
export function wrapPrivateKeyWithDek(privateKey: Uint8Array, dek: Uint8Array): string {
  const packed = aesGcmSeal(dek, privateKey, () => randomBytes(12));
  return bytesToBase64(packed);
}

/** Reverse of {@link wrapPrivateKeyWithDek}. Throws if the DEK is wrong (GCM tag). */
export function unwrapPrivateKeyWithDek(encryptedPrivateKey: string, dek: Uint8Array): Uint8Array {
  const { iv, ciphertextWithTag } = unpackIvCtTag(base64ToBytes(encryptedPrivateKey));
  const privateKey = aesGcmDecrypt(dek, iv, ciphertextWithTag);
  if (privateKey.length !== X25519_KEY_BYTES) {
    throw new Error(`unwrapped private key has wrong length: ${privateKey.length}`);
  }
  return privateKey;
}

function activateSession(privateKey: Uint8Array, publicKeyBase64: string, dek: Uint8Array): void {
  // The session owns these buffers and zeroizes them on clear; hand it copies of
  // the DEK so the caller can safely wipe its own copy afterwards.
  setCryptoSession({
    x25519PrivateKey: privateKey,
    x25519PublicKeyBase64: publicKeyBase64,
    dekWrapKey: new Uint8Array(dek),
    localCacheKey: new Uint8Array(dek),
  });
}

function openExisting(record: UserKeyPairRecord, dek: Uint8Array): void {
  let privateKey: Uint8Array;
  try {
    privateKey = unwrapPrivateKeyWithDek(record.encryptedPrivateKey, dek);
  } catch {
    throw new Error(
      'Failed to decrypt your account key on this device. If you reset your ' +
        'passkey or set up on another platform, you may need to reset E2EE.',
    );
  }

  // Integrity check: derived public key must match the stored one.
  const derivedPub = bytesToBase64(x25519PublicFromPrivate(privateKey));
  if (derivedPub !== record.publicKey) {
    zeroize(privateKey);
    throw new Error('Account key integrity check failed (public key mismatch).');
  }

  activateSession(privateKey, record.publicKey, dek);
}

async function createAndSetup(dek: Uint8Array): Promise<void> {
  const { privateKey, publicKey } = generateX25519KeyPair();
  const publicKeyBase64 = bytesToBase64(publicKey);
  const encryptedPrivateKey = wrapPrivateKeyWithDek(privateKey, dek);

  try {
    await setupKeyPair({ publicKey: publicKeyBase64, encryptedPrivateKey });
  } catch (error) {
    if (isKeyPairAlreadyConfigured(error)) {
      // Race / stale 404: a keypair already exists. Discard the one we just
      // generated and adopt the server's — never overwrite (would orphan data).
      zeroize(privateKey);
      Logger.warn(TAG, 'setup returned 409; adopting existing server keypair');
      const existing = await fetchMyKeyPair();
      if (!existing) {
        throw new Error('Keypair reported as configured but could not be fetched.');
      }
      openExisting(existing, dek);
      return;
    }
    zeroize(privateKey);
    throw error;
  }

  activateSession(privateKey, publicKeyBase64, dek);
}

/**
 * Establish the in-memory {@link CryptoSession} from a freshly unlocked DEK.
 *
 * Call this immediately after a successful Passkey unlock / registration,
 * BEFORE marking the gate as "unlocked", so encrypted TrackFi data can be
 * decrypted. Throws on any unrecoverable error (caller should surface it and
 * keep the gate locked).
 */
export async function establishCryptoSession(dek: Uint8Array): Promise<void> {
  if (dek.length !== 32) {
    throw new Error(`establishCryptoSession: DEK must be 32 bytes (got ${dek.length})`);
  }

  const record = await fetchMyKeyPair();
  if (record) {
    openExisting(record, dek);
    Logger.info(TAG, 'Crypto session established from existing keypair');
  } else {
    await createAndSetup(dek);
    Logger.info(TAG, 'Crypto session established with new keypair');
  }
}
