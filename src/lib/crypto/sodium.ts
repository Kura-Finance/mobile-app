/**
 * libsodium-backed primitives.
 *
 * The X25519 / HKDF / AES-GCM stack is on `@noble/*` because it's the same
 * code path the Web client uses. NaCl `crypto_box_seal` however is a distinct
 * primitive (X25519 + Blake2b nonce derivation + XSalsa20-Poly1305) which
 * we'd have to assemble manually otherwise.
 *
 * For tests, vitest aliases `react-native-libsodium` to `libsodium-wrappers`,
 * which exposes the same `ready` / `crypto_box_seal_open` / `base64_variants`
 * API but runs in Node.
 */

import sodium from 'react-native-libsodium';

let initialized = false;

export async function ensureSodiumReady(): Promise<void> {
  if (initialized) return;
  await sodium.ready;
  initialized = true;
}

/**
 * Open an X25519 sealed box. Layout (per libsodium):
 *
 *   sealed = ephemeralPublicKey(32) || crypto_box(message, ...)
 *
 * Throws on any decoding/auth failure.
 *
 * @param sealedBase64  base64 of the sealed box bytes
 * @param publicKey     recipient's X25519 public key (32 bytes)
 * @param privateKey    recipient's X25519 private key (32 bytes)
 * @returns plaintext bytes
 */
export async function sealedBoxOpen(
  sealedBase64: string,
  publicKey: Uint8Array,
  privateKey: Uint8Array,
): Promise<Uint8Array> {
  await ensureSodiumReady();
  if (publicKey.length !== 32 || privateKey.length !== 32) {
    throw new Error('sealedBoxOpen: X25519 keys must be 32 bytes');
  }
  const sealed = sodium.from_base64(sealedBase64, sodium.base64_variants.ORIGINAL);
  const opened = sodium.crypto_box_seal_open(sealed, publicKey, privateKey);
  if (!opened) {
    throw new Error('sealedBoxOpen: failed to authenticate sealed box');
  }
  return opened as Uint8Array;
}

/** Test helper: only used by vitest to round-trip seal → open. */
export async function sealedBoxSeal(
  plaintext: Uint8Array,
  publicKey: Uint8Array,
): Promise<string> {
  await ensureSodiumReady();
  if (publicKey.length !== 32) {
    throw new Error('sealedBoxSeal: X25519 publicKey must be 32 bytes');
  }
  const sealed = sodium.crypto_box_seal(plaintext, publicKey);
  return sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL);
}
