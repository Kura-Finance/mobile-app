/**
 * Passkey Service
 *
 * Wraps `react-native-passkeys` (WebAuthn FIDO2) with Kura's backend challenge
 * protocol using the PRF extension for client-side DEK encryption.
 *
 * ─── Flow overview ───────────────────────────────────────────────────────────
 *
 * REGISTRATION (one-time per device):
 *   1. Client ← GET /api/auth/passkey/register-challenge
 *   2. Platform WebAuthn dialog → create credential with PRF extension
 *   3. Extract PRF output (32 bytes) from clientExtensionResults
 *   4. Generate random DEK (32 bytes), encryptedDek = XOR(DEK, PRF) → hex
 *   5. Client → POST /api/auth/passkey/register
 *      → { response: <WebAuthn credential object>, encryptedDek: "a3f9...bc" }
 *   ← Server stores credential + encryptedDek (never sees plaintext DEK)
 *
 * AUTHENTICATION (each TrackFi session):
 *   1. Client ← GET /api/auth/passkey/authenticate-challenge
 *   2. Platform WebAuthn dialog → get assertion with PRF extension
 *   3. Client → POST /api/auth/passkey/authenticate
 *      → { response: <WebAuthn assertion object> }
 *   ← Server verifies assertion, returns { encryptedDek }
 *   4. dek = XOR(encryptedDek, PRF_output) ← plaintext DEK restored client-side
 *
 * ─── Security model ──────────────────────────────────────────────────────────
 *   The server NEVER sees the plaintext DEK.
 *   encryptedDek = DEK XOR PRF_output where PRF_output is only derivable by the
 *   physical authenticator bound to the passkey.
 */

import { create, get, isSupported } from 'react-native-passkeys';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from 'react-native-passkeys/build/ReactNativePasskeys.types';
import { getRandomBytes } from 'expo-crypto';
import { requestJson } from '../api/client';
import { KuraApiError } from '../api/errors';
import { brand } from '../../config/branding';
import {
  bytesToHex,
  hexToBytes,
  bytesToBase64Url,
  base64UrlToBytes,
  utf8ToBytes,
} from '../crypto/encoding';
import { aesGcmDecrypt } from '../crypto/aesgcm';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** Relying Party ID — must match the domain hosting apple-app-site-association. */
export const PASSKEY_RP_ID = brand.webCredentialsHost;
export const PASSKEY_RP_NAME = brand.passkeyRpName;

/**
 * Fixed PRF salt used in both registration and authentication.
 * Must be identical on both sides to produce the same PRF output.
 *
 * react-native-passkeys transmits all binary fields as base64url strings
 * (native iOS/Android boundary), so the salt must be base64url-encoded, not
 * a raw Uint8Array. Passing raw bytes triggers a native cast error.
 */
const PRF_SALT_B64URL = bytesToBase64Url(utf8ToBytes('kura-dek-v1'));

// ─────────────────────────────────────────────────────────────────────────────
// Backend API response types
// ─────────────────────────────────────────────────────────────────────────────

interface RegisterChallengeResponse {
  challengeId: string;
  challenge: string; // base64url
  userId: string;    // base64url-encoded Kura user ID
  userName: string;  // display name hint
}

interface AuthenticateChallengeResponse {
  challengeId: string;
  challenge: string; // base64url
  allowCredentials?: Array<{ id: string; type: string }>;
}

interface AuthenticateVerifyResponse {
  /**
   * encryptedDek = XOR(DEK, PRF_output) stored by the server during registration.
   * 64 hex characters = 32 bytes.
   */
  encryptedDek: string;
}

interface PasskeyStatusResponse {
  registered: boolean;
}

const STATUS_CACHE_TTL_MS = 60_000;
let statusCache: { registered: boolean; fetchedAt: number } | null = null;
let statusInFlight: Promise<PasskeyStatusResponse> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPasskeyStatusWithRetry(): Promise<PasskeyStatusResponse> {
  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await requestJson<PasskeyStatusResponse>('/api/auth/passkey/status');
    } catch (err) {
      lastError = err;
      if (err instanceof KuraApiError && err.isRateLimited() && attempt < maxAttempts - 1) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/** Clear cached passkey registration status (after register / reset). */
export function invalidatePasskeyStatusCache(): void {
  statusCache = null;
}

export async function getPasskeyStatus(options?: { force?: boolean }): Promise<PasskeyStatusResponse> {
  const now = Date.now();
  if (!options?.force && statusCache && now - statusCache.fetchedAt < STATUS_CACHE_TTL_MS) {
    return { registered: statusCache.registered };
  }

  if (!options?.force && statusInFlight) {
    return statusInFlight;
  }

  statusInFlight = fetchPasskeyStatusWithRetry()
    .then((result) => {
      statusCache = { registered: result.registered, fetchedAt: Date.now() };
      statusInFlight = null;
      return result;
    })
    .catch((err) => {
      statusInFlight = null;
      throw err;
    });

  return statusInFlight;
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract the PRF output as bytes from a WebAuthn response.
 *
 * react-native-passkeys returns `clientExtensionResults.prf.results.first` as a
 * base64url string (binary is serialized across the native bridge), so we decode
 * it rather than wrapping an ArrayBuffer.
 * Throws if the authenticator did not return a PRF result (device unsupported).
 */
function extractPrfOutput(clientExtensionResults: any): Uint8Array {
  const first = clientExtensionResults?.prf?.results?.first;
  if (!first) {
    throw new Error(
      'This device does not support the Passkey PRF extension (iOS 16+ / Android FIDO2 required). ' +
      'Cannot derive encryption key.',
    );
  }
  // Native returns base64url string; web may return ArrayBuffer — handle both.
  if (typeof first === 'string') {
    return base64UrlToBytes(first);
  }
  return new Uint8Array(first as ArrayBuffer);
}

/**
 * XOR two equal-length Uint8Arrays.
 * Used for both encrypting (DEK XOR PRF → encryptedDek)
 * and decrypting (encryptedDek XOR PRF → DEK).
 */
function xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  if (a.length !== b.length) throw new Error(`XOR length mismatch: ${a.length} vs ${b.length}`);
  return a.map((byte, i) => byte ^ b[i]!);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function passkeyIsSupported(): boolean {
  try {
    return isSupported();
  } catch {
    return false;
  }
}

export interface E2EEResetResult {
  reset: boolean;
  passkeysDeleted: number;
  payloadKeysDeleted: number;
  cachesCleared: Record<string, number>;
}

/**
 * POST /api/auth/keys/reset
 *
 * Wipe the entire E2EE layer in one transaction:
 *   - All PasskeyCredentials + pending WebAuthn challenges
 *   - User keypair fields (publicKey / encryptedPrivateKey / kekSalt)
 *   - All EncryptedPayloadKeys (wrappedSek)
 *   - All encrypted caches (Plaid, exchange, DeBank, AssetSnapshot)
 *   - Sync logs (so next sync re-builds with new keypair)
 *
 * Connections are kept (PlaidItem.accessToken, ExchangeAccount.apiKey) —
 * the user won't need to re-link their bank / exchange after the reset.
 *
 * Requires only a valid Kura JWT (Privy login); no old passkey assertion needed —
 * the user just lost their passkey, so we cannot demand it.
 */
export async function resetE2EE(): Promise<E2EEResetResult> {
  const result = await requestJson<E2EEResetResult>('/api/auth/keys/reset', { method: 'POST' });
  invalidatePasskeyStatusCache();
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a new Passkey for the authenticated user.
 *
 * On success, returns the plaintext DEK (32 bytes) which the caller should
 * persist in SecureStore immediately.  Returns null if the user cancelled.
 * Throws on network / server / PRF-unsupported error.
 */
export async function registerPasskey(displayName: string): Promise<Uint8Array | null> {
  if (!passkeyIsSupported()) {
    throw new Error('Passkeys are not supported on this device (iOS 16+ / Android 9+ required).');
  }

  // ── Step 1: Get registration challenge ─────────────────────────────────────
  const challengeData = await requestJson<RegisterChallengeResponse>(
    '/api/auth/passkey/register-challenge',
  );

  // ── Step 2: Build creation options + PRF extension ─────────────────────────
  const creationOptions = {
    rp: { id: PASSKEY_RP_ID, name: PASSKEY_RP_NAME },
    user: {
      id: challengeData.userId,
      name: displayName,
      displayName,
    },
    challenge: challengeData.challenge,
    pubKeyCredParams: [
      { alg: -7,   type: 'public-key' as const }, // ES256
      { alg: -257, type: 'public-key' as const }, // RS256 fallback
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform' as const,
      userVerification: 'required' as const,
      residentKey: 'required' as const,
    },
    timeout: 60_000,
    attestation: 'none' as const,
    extensions: {
      prf: { eval: { first: PRF_SALT_B64URL } },
    },
  } as unknown as PublicKeyCredentialCreationOptionsJSON;

  // ── Step 3: Trigger platform passkey dialog ────────────────────────────────
  const credential = await create(creationOptions);
  if (!credential) return null; // User cancelled

  // ── Step 4: Extract PRF output from authenticator ──────────────────────────
  const prfOutput = extractPrfOutput((credential as any).clientExtensionResults);

  // ── Step 5: Generate random DEK, XOR-encrypt with PRF output ───────────────
  const dek = getRandomBytes(32);                     // Uint8Array, 32 bytes
  const encryptedDekBytes = xorBytes(dek, prfOutput); // XOR
  const encryptedDek = bytesToHex(encryptedDekBytes); // 64 hex chars

  // ── Step 6: POST credential + encryptedDek to backend ─────────────────────
  // WebAuthn response object wrapped in "response" key per API contract.
  await requestJson('/api/auth/passkey/register', {
    method: 'POST',
    body: JSON.stringify({
      response: credential,  // whole WebAuthn credential object
      encryptedDek,
    }),
  });

  statusCache = { registered: true, fetchedAt: Date.now() };

  // Return plaintext DEK to caller for immediate SecureStore persistence
  return dek;
}

// ─────────────────────────────────────────────────────────────────────────────
// Authentication → DEK retrieval
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authenticate with a registered Passkey and recover the plaintext DEK.
 *
 * Returns the 32-byte DEK for in-memory use.
 * Returns null if the user cancelled.
 * Throws on network / server / PRF-unsupported error.
 */
export async function authenticatePasskeyForDek(): Promise<Uint8Array | null> {
  if (!passkeyIsSupported()) {
    throw new Error('Passkeys are not supported on this device.');
  }

  // ── Step 1: Get assertion challenge ────────────────────────────────────────
  const challengeData = await requestJson<AuthenticateChallengeResponse>(
    '/api/auth/passkey/authenticate-challenge',
  );

  // ── Step 2: Build request options + PRF extension ──────────────────────────
  const requestOptions = {
    rpId: PASSKEY_RP_ID,
    challenge: challengeData.challenge,
    userVerification: 'required' as const,
    timeout: 60_000,
    extensions: {
      prf: { eval: { first: PRF_SALT_B64URL } },
    },
    ...(challengeData.allowCredentials
      ? {
          allowCredentials: challengeData.allowCredentials.map((c) => ({
            ...c,
            type: 'public-key' as const,
          })),
        }
      : {}),
  } as unknown as PublicKeyCredentialRequestOptionsJSON;

  // ── Step 3: Trigger platform passkey dialog ────────────────────────────────
  const assertion = await get(requestOptions);
  if (!assertion) return null; // User cancelled

  // ── Step 4: Extract PRF output before it leaves the authenticator ──────────
  const prfOutput = extractPrfOutput((assertion as any).clientExtensionResults);

  // ── Step 5: POST assertion to backend, receive encryptedDek ───────────────
  const verifyResponse = await requestJson<AuthenticateVerifyResponse>(
    '/api/auth/passkey/authenticate',
    {
      method: 'POST',
      body: JSON.stringify({
        response: assertion, // whole WebAuthn assertion object
      }),
    },
  );

  // ── Step 6: XOR encryptedDek with PRF output → plaintext DEK ───────────────
  const encryptedDekBytes = hexToBytes(verifyResponse.encryptedDek);
  if (encryptedDekBytes.length !== 32) {
    throw new Error(
      `Unexpected encryptedDek length: ${encryptedDekBytes.length} bytes (expected 32).`,
    );
  }
  const dek = xorBytes(encryptedDekBytes, prfOutput);
  return dek;
}
