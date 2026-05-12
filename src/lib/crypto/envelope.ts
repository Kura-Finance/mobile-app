/**
 * Phase 3 envelope decryption — generic for plaid/asset/exchange/debank.
 *
 * Server response shape (per `getEncryptedFinanceSnapshot`):
 *
 *   {
 *     payloadKeys: Array<{ id, scope, wrappedSek, algorithm }>;
 *     rows:        Array<{ payloadCiphertext, payloadKeyId, ...metadata }>;
 *   }
 *
 *   - `wrappedSek`        = base64( crypto_box_seal(sek32, userPublicKey) )
 *   - `payloadCiphertext` = base64( iv(12) || tag(16) || ciphertext )
 *   - `algorithm`         = "x25519-sealedbox+aes-256-gcm"
 *
 * Decrypt pipeline:
 *   1. For each payload key, sealedBoxOpen → 32-byte SEK
 *   2. For each row, look up its SEK, then AES-256-GCM-decrypt
 *      `iv|tag|ct` to recover the plaintext JSON
 *   3. Zero out SEKs at the end (best-effort)
 *
 * If any payload key is missing from `payloadKeys` we return the row with
 * `decryptionError` set rather than throwing — that way one rotten row
 * doesn't kill the whole snapshot.
 */

import { aesGcmDecrypt, unpackIvTagCt } from './aesgcm';
import { base64ToBytes, bytesToUtf8 } from './encoding';
import { sealedBoxOpen } from './sodium';
import { requireCryptoSession } from './session';

export const PHASE3_ALGORITHM = 'x25519-sealedbox+aes-256-gcm';

export interface PayloadKeyEnvelope {
  id: string;
  scope: string;
  wrappedSek: string;
  algorithm: string;
}

export interface EncryptedRow {
  payloadCiphertext: string;
  payloadKeyId: string;
}

export interface DecryptedRow<TPayload, TRow extends EncryptedRow> {
  row: Omit<TRow, 'payloadCiphertext' | 'payloadKeyId'>;
  payload: TPayload;
}

export interface DecryptedFailure<TRow extends EncryptedRow> {
  row: Omit<TRow, 'payloadCiphertext' | 'payloadKeyId'>;
  error: string;
}

export interface UnwrapEnvelopeOptions {
  /** X25519 public key in raw 32 bytes. Defaults to current crypto session. */
  publicKey?: Uint8Array;
  /** X25519 private key in raw 32 bytes. Defaults to current crypto session. */
  privateKey?: Uint8Array;
}

/**
 * Unwrap every payload key in the envelope into a `Map<id, SEK>`.
 *
 * The returned map's values are caller-owned — call {@link zeroizeSekMap} when
 * finished, before any UI render path keeps references.
 */
export async function unwrapPayloadKeys(
  payloadKeys: PayloadKeyEnvelope[],
  opts: UnwrapEnvelopeOptions = {},
): Promise<Map<string, Uint8Array>> {
  const session = opts.privateKey
    ? null
    : requireCryptoSession();
  const privateKey = opts.privateKey ?? session!.x25519PrivateKey;
  const publicKey = opts.publicKey ?? base64ToBytes(session!.x25519PublicKeyBase64);

  const out = new Map<string, Uint8Array>();
  for (const pk of payloadKeys) {
    if (pk.algorithm !== PHASE3_ALGORITHM) {
      throw new Error(`unwrapPayloadKeys: unsupported algorithm "${pk.algorithm}" for key ${pk.id}`);
    }
    const sek = await sealedBoxOpen(pk.wrappedSek, publicKey, privateKey);
    if (sek.length !== 32) {
      throw new Error(`unwrapPayloadKeys: unexpected SEK length ${sek.length} for key ${pk.id}`);
    }
    out.set(pk.id, sek);
  }
  return out;
}

export function zeroizeSekMap(map: Map<string, Uint8Array>): void {
  for (const sek of map.values()) {
    sek.fill(0);
  }
  map.clear();
}

/**
 * Decrypt one packed `payloadCiphertext` blob with the SEK identified by
 * `payloadKeyId`. Throws if the key isn't in the map.
 */
export function decryptRowPayload<T>(
  payloadCiphertext: string,
  payloadKeyId: string,
  seks: Map<string, Uint8Array>,
): T {
  const sek = seks.get(payloadKeyId);
  if (!sek) {
    throw new Error(`decryptRowPayload: missing SEK for payloadKeyId=${payloadKeyId}`);
  }
  const packed = base64ToBytes(payloadCiphertext);
  const { iv, ciphertextWithTag } = unpackIvTagCt(packed);
  const plain = aesGcmDecrypt(sek, iv, ciphertextWithTag);
  return JSON.parse(bytesToUtf8(plain)) as T;
}

/**
 * High-level helper: decrypt every row in an envelope, classifying each as
 * success or failure. Caller can choose whether to log or drop failures.
 */
export async function decryptEnvelopeRows<TPayload, TRow extends EncryptedRow>(
  payloadKeys: PayloadKeyEnvelope[],
  rows: TRow[],
  opts: UnwrapEnvelopeOptions = {},
): Promise<{
  decrypted: DecryptedRow<TPayload, TRow>[];
  failed: DecryptedFailure<TRow>[];
}> {
  const seks = await unwrapPayloadKeys(payloadKeys, opts);
  const decrypted: DecryptedRow<TPayload, TRow>[] = [];
  const failed: DecryptedFailure<TRow>[] = [];

  try {
    for (const row of rows) {
      const { payloadCiphertext, payloadKeyId, ...metadata } = row as TRow & EncryptedRow;
      try {
        const payload = decryptRowPayload<TPayload>(payloadCiphertext, payloadKeyId, seks);
        decrypted.push({
          row: metadata as Omit<TRow, 'payloadCiphertext' | 'payloadKeyId'>,
          payload,
        });
      } catch (error) {
        failed.push({
          row: metadata as Omit<TRow, 'payloadCiphertext' | 'payloadKeyId'>,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { decrypted, failed };
  } finally {
    zeroizeSekMap(seks);
  }
}
