/**
 * Hex / base64 / utf8 codec helpers used everywhere in the crypto stack.
 *
 * Base64 is delegated to `@stablelib/base64` for correctness (RFC 4648, padding
 * required). Hex helpers mirror the WebClient implementation byte-for-byte.
 */

import { encode as b64encode, decode as b64decode, encodeURLSafe as b64urlEncode } from '@stablelib/base64';

// ─── Base64url (RFC 4648 §5, no padding) ─────────────────────────────────────

export function bytesToBase64Url(bytes: Uint8Array): string {
  return b64urlEncode(bytes).replace(/=/g, '');
}

export function base64UrlToBytes(b64url: string): Uint8Array {
  // Restore standard padding before decoding
  const padded = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = padded.length % 4;
  return b64decode(pad === 0 ? padded : padded + '===='.slice(pad));
}

export function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.trim().toLowerCase();
  if (normalized.length % 2 !== 0) {
    throw new Error(`hexToBytes: odd length string (${normalized.length})`);
  }
  if (!/^[0-9a-f]*$/.test(normalized)) {
    throw new Error('hexToBytes: contains non-hex characters');
  }
  const out = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    s += bytes[i].toString(16).padStart(2, '0');
  }
  return s;
}

export function bytesToBase64(bytes: Uint8Array): string {
  return b64encode(bytes);
}

export function base64ToBytes(base64: string): Uint8Array {
  return b64decode(base64);
}

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

export function utf8ToBytes(s: string): Uint8Array {
  return utf8Encoder.encode(s);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return utf8Decoder.decode(bytes);
}

/**
 * Zero out the contents of a Uint8Array. Used to scrub secrets from memory.
 * Note: best-effort only; JS engines may keep copies around.
 */
export function zeroize(bytes: Uint8Array): void {
  bytes.fill(0);
}
