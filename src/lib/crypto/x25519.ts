/**
 * X25519 wrappers on `@noble/curves/ed25519`.
 *
 * Mirrors `app/lib/crypto/keyDerivation.ts` on the web side. The public API
 * returns raw 32-byte buffers; serialisation to base64 is done by the caller.
 */

import { x25519 } from '@noble/curves/ed25519.js';
import { randomBytes } from './random';

export const X25519_KEY_BYTES = 32;

export interface X25519KeyPair {
  /** raw 32 bytes secret key (RFC 7748 clamped by noble). */
  privateKey: Uint8Array;
  /** raw 32 bytes public key. */
  publicKey: Uint8Array;
}

export function generateX25519KeyPair(): X25519KeyPair {
  const privateKey = randomBytes(X25519_KEY_BYTES);
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/** Derive the raw 32-byte X25519 public key from a raw private key. */
export function x25519PublicFromPrivate(privateKey: Uint8Array): Uint8Array {
  if (privateKey.length !== X25519_KEY_BYTES) {
    throw new Error(`x25519 private key must be ${X25519_KEY_BYTES} bytes`);
  }
  return x25519.getPublicKey(privateKey);
}
