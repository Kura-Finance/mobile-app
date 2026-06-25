import { describe, expect, test } from 'vitest';
import './shims/getRandomValues';
import { generateX25519KeyPair, x25519PublicFromPrivate, X25519_KEY_BYTES } from '../x25519';

describe('X25519 keypair', () => {
  test('generateX25519KeyPair produces 32-byte keys', () => {
    const { privateKey, publicKey } = generateX25519KeyPair();
    expect(privateKey.length).toBe(X25519_KEY_BYTES);
    expect(publicKey.length).toBe(X25519_KEY_BYTES);
  });

  test('x25519PublicFromPrivate matches generated public key', () => {
    const { privateKey, publicKey } = generateX25519KeyPair();
    expect(Array.from(x25519PublicFromPrivate(privateKey))).toEqual(Array.from(publicKey));
  });
});
