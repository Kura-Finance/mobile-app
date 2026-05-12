/**
 * Polyfill global.crypto.subtle for React Native / Hermes.
 *
 * This covers the path where global.crypto already exists from
 * react-native-get-random-values but lacks .subtle.
 *
 * tssrp6a needs SHA-1 / SHA-256 / SHA-384 / SHA-512.
 */

import { sha256, sha512, sha384 } from '@noble/hashes/sha2.js';
import { sha1 } from '@noble/hashes/legacy.js';

function toUint8Array(data: BufferSource): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(
    (data as ArrayBufferView).buffer,
    (data as ArrayBufferView).byteOffset,
    (data as ArrayBufferView).byteLength,
  );
}

const subtleShim = {
  digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer> {
    const alg = typeof algorithm === 'string' ? algorithm : (algorithm as Algorithm).name;
    const b = toUint8Array(data);
    if (alg === 'SHA-256') return Promise.resolve(sha256(b).buffer as ArrayBuffer);
    if (alg === 'SHA-512') return Promise.resolve(sha512(b).buffer as ArrayBuffer);
    if (alg === 'SHA-384') return Promise.resolve(sha384(b).buffer as ArrayBuffer);
    if (alg === 'SHA-1')   return Promise.resolve(sha1(b).buffer as ArrayBuffer);
    return Promise.reject(new Error(`cryptoSubtle shim: unsupported "${alg}"`));
  },
} as SubtleCrypto;

if (typeof global !== 'undefined') {
  if (!global.crypto) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).crypto = {};
  }
  if (!global.crypto.subtle) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global.crypto as any).subtle = subtleShim;
  }
}
