import { describe, expect, test } from 'vitest';
import './shims/getRandomValues';
import sodium from 'libsodium-wrappers';
import { sealedBoxOpen, sealedBoxSeal, ensureSodiumReady } from '../sodium';

describe('libsodium sealed box', () => {
  test('seal → open round trip with random keypair', async () => {
    await sodium.ready;
    await ensureSodiumReady();
    const kp = sodium.crypto_box_keypair();
    const plaintext = new TextEncoder().encode('hello sek 32 bytes payload');

    const sealedB64 = await sealedBoxSeal(plaintext, kp.publicKey);
    const opened = await sealedBoxOpen(sealedB64, kp.publicKey, kp.privateKey);

    expect(new TextDecoder().decode(opened)).toBe('hello sek 32 bytes payload');
  });

  test('open with wrong private key fails', async () => {
    await sodium.ready;
    const recipient = sodium.crypto_box_keypair();
    const attacker = sodium.crypto_box_keypair();
    const sealed = await sealedBoxSeal(
      new Uint8Array([1, 2, 3, 4, 5]),
      recipient.publicKey,
    );
    await expect(
      sealedBoxOpen(sealed, recipient.publicKey, attacker.privateKey),
    ).rejects.toThrow();
  });

  test('SEK round-trip — what the plaid envelope does in production', async () => {
    await sodium.ready;
    const kp = sodium.crypto_box_keypair();
    const sek = new Uint8Array(32);
    for (let i = 0; i < 32; i++) sek[i] = (i * 7) & 0xff;

    const wrappedSek = await sealedBoxSeal(sek, kp.publicKey);
    const opened = await sealedBoxOpen(wrappedSek, kp.publicKey, kp.privateKey);

    expect(opened.length).toBe(32);
    expect(Array.from(opened)).toEqual(Array.from(sek));
  });
});
