/**
 * In-memory crypto session.
 *
 * Holds the user's X25519 private key (raw 32 bytes), corresponding public key
 * (base64), and AES-256-GCM material derived from the password. Cleared on
 * logout, on background-lock, and on every login/register attempt before being
 * re-populated.
 *
 * NEVER persist any of this to disk — it lives only for the active session.
 */

import { zeroize } from './encoding';

export interface CryptoSession {
  /** X25519 private key — raw 32 bytes (RFC 7748 clamped). */
  x25519PrivateKey: Uint8Array;
  /** X25519 public key — base64, 44 chars including padding. */
  x25519PublicKeyBase64: string;
  /** AES-256-GCM key used to wrap/unwrap encryptedPrivateKey. 32 bytes. */
  dekWrapKey: Uint8Array;
  /** AES-256-GCM key derived from password (HKDF). Reserved for future use. 32 bytes. */
  localCacheKey: Uint8Array;
}

let session: CryptoSession | null = null;

export function getCryptoSession(): CryptoSession | null {
  return session;
}

export function setCryptoSession(next: CryptoSession): void {
  if (session) {
    clearCryptoSession();
  }
  session = next;
}

export function clearCryptoSession(): void {
  if (!session) return;
  zeroize(session.x25519PrivateKey);
  zeroize(session.dekWrapKey);
  zeroize(session.localCacheKey);
  session = null;
}

export function requireCryptoSession(): CryptoSession {
  if (!session) {
    throw new Error('No active crypto session. Please sign in again.');
  }
  return session;
}
