/**
 * AES-256-GCM helpers built on `@noble/ciphers/aes`.
 *
 * `gcm(key, iv).encrypt(plain)` returns `ciphertext || tag` concatenated, the
 * same layout WebCrypto produces. Callers serialise as one of two packed forms
 * depending on the endpoint contract:
 *
 *   1. **Concat layout** `iv(12) | ct | tag(16)` — used by Web's
 *      `encryptedPrivateKey` and the Phase 3 `decryptServerEnvelope` where the
 *      ciphertext field is the raw GCM output.
 *
 *   2. **Tag-prefixed layout** `iv(12) | tag(16) | ct` — used by the Phase 3
 *      per-row `payloadCiphertext`. The tag is moved to the front of the
 *      ciphertext blob; we re-order back to `ct || tag` before feeding GCM.
 *
 * Tag length is fixed to 16 bytes (GCM standard) and IV length to 12 bytes.
 */

import { gcm } from '@noble/ciphers/aes.js';

export const AES_GCM_IV_BYTES = 12;
export const AES_GCM_TAG_BYTES = 16;

export type AesGcmKey = Uint8Array; // 32 bytes for AES-256

function assertKey(key: AesGcmKey): void {
  if (key.length !== 32) {
    throw new Error(`AES-256-GCM key must be 32 bytes (got ${key.length})`);
  }
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export function aesGcmEncrypt(
  key: AesGcmKey,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad?: Uint8Array,
): Uint8Array {
  assertKey(key);
  if (iv.length !== AES_GCM_IV_BYTES) {
    throw new Error(`iv must be ${AES_GCM_IV_BYTES} bytes (got ${iv.length})`);
  }
  return gcm(key, iv, aad).encrypt(plaintext);
}

export function aesGcmDecrypt(
  key: AesGcmKey,
  iv: Uint8Array,
  ciphertextWithTag: Uint8Array,
  aad?: Uint8Array,
): Uint8Array {
  assertKey(key);
  if (iv.length !== AES_GCM_IV_BYTES) {
    throw new Error(`iv must be ${AES_GCM_IV_BYTES} bytes (got ${iv.length})`);
  }
  if (ciphertextWithTag.length < AES_GCM_TAG_BYTES) {
    throw new Error('ciphertext too short to contain a tag');
  }
  return gcm(key, iv, aad).decrypt(ciphertextWithTag);
}

/**
 * `iv(12) | ct | tag(16)` packed bytes → split into parts.
 */
export function unpackIvCtTag(packed: Uint8Array): {
  iv: Uint8Array;
  ciphertextWithTag: Uint8Array;
} {
  if (packed.length < AES_GCM_IV_BYTES + AES_GCM_TAG_BYTES) {
    throw new Error('packed AES-GCM blob too short');
  }
  return {
    iv: packed.slice(0, AES_GCM_IV_BYTES),
    ciphertextWithTag: packed.slice(AES_GCM_IV_BYTES),
  };
}

/**
 * `iv(12) | tag(16) | ct(N-28)` packed bytes → re-order to `ct || tag` for GCM.
 */
export function unpackIvTagCt(packed: Uint8Array): {
  iv: Uint8Array;
  ciphertextWithTag: Uint8Array;
} {
  if (packed.length < AES_GCM_IV_BYTES + AES_GCM_TAG_BYTES) {
    throw new Error('packed AES-GCM blob too short');
  }
  const iv = packed.slice(0, AES_GCM_IV_BYTES);
  const tag = packed.slice(AES_GCM_IV_BYTES, AES_GCM_IV_BYTES + AES_GCM_TAG_BYTES);
  const ct = packed.slice(AES_GCM_IV_BYTES + AES_GCM_TAG_BYTES);
  return { iv, ciphertextWithTag: concatBytes(ct, tag) };
}

/**
 * Encrypt and serialise as `iv | ct | tag` (random IV).
 */
export function aesGcmSeal(
  key: AesGcmKey,
  plaintext: Uint8Array,
  ivFactory: () => Uint8Array,
  aad?: Uint8Array,
): Uint8Array {
  const iv = ivFactory();
  if (iv.length !== AES_GCM_IV_BYTES) {
    throw new Error(`ivFactory must produce ${AES_GCM_IV_BYTES} bytes`);
  }
  const ctTag = aesGcmEncrypt(key, iv, plaintext, aad);
  const out = new Uint8Array(iv.length + ctTag.length);
  out.set(iv, 0);
  out.set(ctTag, iv.length);
  return out;
}
