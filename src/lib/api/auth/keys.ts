/**
 * E2EE user-keypair endpoints (`/api/auth/keys/*`).
 *
 * The backend stores the user's X25519 keypair record:
 *   - `publicKey`           — base64, 32-byte X25519 public key
 *   - `encryptedPrivateKey` — client-owned opaque blob (we wrap with the DEK)
 *   - `kekSalt`             — optional KDF salt (null for Passkey-PRF DEK)
 *
 * The plaintext private key NEVER leaves the device; the server treats
 * `encryptedPrivateKey` as opaque bytes.
 *
 * Anti-orphan contract (see {@link establishCryptoSession}):
 *   GET /api/auth/keys/me  → 200 record | 404 KEY_PAIR_NOT_FOUND
 *   POST /api/auth/keys/setup → 201 | 409 KEY_PAIR_ALREADY_CONFIGURED
 * Always GET before POST so an existing keypair is never overwritten.
 */

import { requestJson } from '../client';
import { KuraApiError } from '../errors';
import { userKeyPairRecordSchema, type UserKeyPairRecord } from './schemas';

const apiName = 'AuthKeysApi';

export interface SetupKeyPairBody {
  /** base64, 44 chars — X25519 32-byte public key. */
  publicKey: string;
  /** base64 — DEK-wrapped private key (iv | ct | tag). */
  encryptedPrivateKey: string;
  /** hex KDF salt, optional. Omit when the DEK needs no salt. */
  kekSalt?: string;
}

/**
 * GET /api/auth/keys/me
 *
 * Returns the user's keypair record, or `null` when none has been configured
 * yet (HTTP 404 / code `KEY_PAIR_NOT_FOUND`). All other failures throw.
 */
export async function fetchMyKeyPair(): Promise<UserKeyPairRecord | null> {
  try {
    const data = await requestJson<unknown>('/api/auth/keys/me', {
      method: 'GET',
      apiName,
    });
    return userKeyPairRecordSchema.parse(data);
  } catch (error) {
    if (
      error instanceof KuraApiError &&
      (error.status === 404 || error.code === 'KEY_PAIR_NOT_FOUND')
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * POST /api/auth/keys/setup
 *
 * Persists a freshly generated keypair. The backend hard-blocks overwrites:
 * if a keypair already exists it returns 409 `KEY_PAIR_ALREADY_CONFIGURED`,
 * which callers must treat as "re-GET and unwrap", never as "force overwrite".
 */
export async function setupKeyPair(body: SetupKeyPairBody): Promise<void> {
  await requestJson<unknown>('/api/auth/keys/setup', {
    method: 'POST',
    body: JSON.stringify(body),
    apiName,
  });
}

/** True when the error means "a keypair already exists server-side". */
export function isKeyPairAlreadyConfigured(error: unknown): boolean {
  return (
    error instanceof KuraApiError &&
    (error.status === 409 || error.code === 'KEY_PAIR_ALREADY_CONFIGURED')
  );
}
