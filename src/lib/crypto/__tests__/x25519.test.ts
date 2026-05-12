import { describe, expect, test } from 'vitest';
import './shims/getRandomValues';
import { bytesToHex } from '../encoding';
import { deriveSharedSecret, generateX25519KeyPair, X25519_KEY_BYTES } from '../x25519';

describe('X25519 ECDH', () => {
  test('keypair shapes', () => {
    const { privateKey, publicKey } = generateX25519KeyPair();
    expect(privateKey.length).toBe(X25519_KEY_BYTES);
    expect(publicKey.length).toBe(X25519_KEY_BYTES);
  });

  test('symmetric shared secret', () => {
    const alice = generateX25519KeyPair();
    const bob = generateX25519KeyPair();
    const ab = deriveSharedSecret(alice.privateKey, bob.publicKey);
    const ba = deriveSharedSecret(bob.privateKey, alice.publicKey);
    expect(bytesToHex(ab)).toBe(bytesToHex(ba));
    expect(ab.length).toBe(X25519_KEY_BYTES);
  });
});
