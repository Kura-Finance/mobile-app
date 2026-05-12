import { describe, expect, test } from 'vitest';
import './shims/getRandomValues';
import sodium from 'libsodium-wrappers';
import {
  PHASE3_ALGORITHM,
  decryptEnvelopeRows,
  decryptRowPayload,
  unwrapPayloadKeys,
  type EncryptedRow,
  type PayloadKeyEnvelope,
} from '../envelope';
import { aesGcmEncrypt, AES_GCM_IV_BYTES, AES_GCM_TAG_BYTES } from '../aesgcm';
import { bytesToBase64 } from '../encoding';
import { sealedBoxSeal } from '../sodium';

/**
 * Build a Phase 3 envelope the way the backend would, then decrypt it the
 * way the RN client must.
 */
async function buildPayloadKey(opts: {
  scope: string;
  publicKey: Uint8Array;
  sek: Uint8Array;
}): Promise<PayloadKeyEnvelope> {
  const wrappedSek = await sealedBoxSeal(opts.sek, opts.publicKey);
  return {
    id: opts.scope,
    scope: opts.scope,
    wrappedSek,
    algorithm: PHASE3_ALGORITHM,
  };
}

function buildRow<T>(payload: T, sek: Uint8Array, payloadKeyId: string): EncryptedRow & { extra: number } {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  for (let i = 0; i < AES_GCM_IV_BYTES; i++) iv[i] = i;
  const ctTag = aesGcmEncrypt(sek, iv, plaintext);
  // ct+tag from @noble = ct(N) || tag(16); backend packs iv|tag|ct so we
  // need to re-arrange before base64.
  const ct = ctTag.slice(0, ctTag.length - AES_GCM_TAG_BYTES);
  const tag = ctTag.slice(ctTag.length - AES_GCM_TAG_BYTES);
  const packed = new Uint8Array(iv.length + tag.length + ct.length);
  packed.set(iv, 0);
  packed.set(tag, iv.length);
  packed.set(ct, iv.length + tag.length);

  return {
    extra: 42,
    payloadCiphertext: bytesToBase64(packed),
    payloadKeyId,
  };
}

describe('phase 3 envelope', () => {
  test('unwrapPayloadKeys recovers each SEK', async () => {
    await sodium.ready;
    const kp = sodium.crypto_box_keypair();
    const sek1 = new Uint8Array(32).fill(0x11);
    const sek2 = new Uint8Array(32).fill(0x22);
    const payloadKeys = [
      await buildPayloadKey({ scope: 'k1', publicKey: kp.publicKey, sek: sek1 }),
      await buildPayloadKey({ scope: 'k2', publicKey: kp.publicKey, sek: sek2 }),
    ];

    const seks = await unwrapPayloadKeys(payloadKeys, {
      publicKey: kp.publicKey,
      privateKey: kp.privateKey,
    });

    expect(seks.size).toBe(2);
    expect(Array.from(seks.get('k1')!)).toEqual(Array.from(sek1));
    expect(Array.from(seks.get('k2')!)).toEqual(Array.from(sek2));
  });

  test('unwrapPayloadKeys rejects unknown algorithm', async () => {
    await sodium.ready;
    const kp = sodium.crypto_box_keypair();
    await expect(
      unwrapPayloadKeys(
        [
          {
            id: 'x',
            scope: 'x',
            wrappedSek: await sealedBoxSeal(new Uint8Array(32), kp.publicKey),
            algorithm: 'something-else',
          },
        ],
        { publicKey: kp.publicKey, privateKey: kp.privateKey },
      ),
    ).rejects.toThrow(/unsupported algorithm/);
  });

  test('decryptEnvelopeRows full round trip with mixed keys', async () => {
    await sodium.ready;
    const kp = sodium.crypto_box_keypair();
    const sek1 = new Uint8Array(32).fill(0xaa);
    const sek2 = new Uint8Array(32).fill(0xbb);

    const payloadKeys = [
      await buildPayloadKey({ scope: 'k1', publicKey: kp.publicKey, sek: sek1 }),
      await buildPayloadKey({ scope: 'k2', publicKey: kp.publicKey, sek: sek2 }),
    ];

    const rows = [
      buildRow({ name: 'Alice', balance: 1000 }, sek1, 'k1'),
      buildRow({ name: 'Bob', balance: 2500 }, sek2, 'k2'),
      buildRow({ name: 'Carol', balance: 50 }, sek1, 'k1'),
    ];

    const { decrypted, failed } = await decryptEnvelopeRows<
      { name: string; balance: number },
      (typeof rows)[number]
    >(payloadKeys, rows, {
      publicKey: kp.publicKey,
      privateKey: kp.privateKey,
    });

    expect(failed.length).toBe(0);
    expect(decrypted.map((d) => d.payload.name)).toEqual(['Alice', 'Bob', 'Carol']);
    expect(decrypted.map((d) => d.payload.balance)).toEqual([1000, 2500, 50]);
    // metadata is preserved
    expect(decrypted[0].row.extra).toBe(42);
  });

  test('row referencing missing payloadKeyId is classified as failure', async () => {
    await sodium.ready;
    const kp = sodium.crypto_box_keypair();
    const sek = new Uint8Array(32).fill(0x77);
    const payloadKeys = [
      await buildPayloadKey({ scope: 'k1', publicKey: kp.publicKey, sek }),
    ];
    const validRow = buildRow({ amount: 1 }, sek, 'k1');
    const orphanRow = { ...buildRow({ amount: 2 }, sek, 'k1'), payloadKeyId: 'ghost' };

    const { decrypted, failed } = await decryptEnvelopeRows<
      { amount: number },
      typeof validRow
    >(payloadKeys, [validRow, orphanRow], {
      publicKey: kp.publicKey,
      privateKey: kp.privateKey,
    });

    expect(decrypted.length).toBe(1);
    expect(failed.length).toBe(1);
    expect(failed[0].error).toMatch(/missing SEK/);
  });

  test('decryptRowPayload errors on wrong key id', async () => {
    const seks = new Map<string, Uint8Array>();
    expect(() => decryptRowPayload('AAAA', 'nope', seks)).toThrow();
  });
});
