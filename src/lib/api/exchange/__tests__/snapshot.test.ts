import { describe, expect, test } from 'vitest';
import '../../../crypto/__tests__/shims/getRandomValues';
import sodium from 'libsodium-wrappers';
import { aesGcmEncrypt, AES_GCM_IV_BYTES, AES_GCM_TAG_BYTES } from '../../../crypto/aesgcm';
import { bytesToBase64 } from '../../../crypto/encoding';
import { setCryptoSession, clearCryptoSession } from '../../../crypto/session';
import { sealedBoxSeal } from '../../../crypto/sodium';
import { PHASE3_ALGORITHM } from '../../../crypto/envelope';
import {
  encryptedExchangeSnapshotSchema,
  type AssetPayload,
  type BalancePayload,
} from '../schemas';

/**
 * Build a single Phase 3 row the way the backend does:
 *   payloadCiphertext = base64( iv(12) | tag(16) | ciphertext )
 */
function buildRow(payload: unknown, sek: Uint8Array, payloadKeyId: string, symbol: string) {
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const iv = new Uint8Array(AES_GCM_IV_BYTES);
  for (let i = 0; i < AES_GCM_IV_BYTES; i++) iv[i] = (i * 13) & 0xff;
  const ctTag = aesGcmEncrypt(sek, iv, plaintext);
  const ct = ctTag.slice(0, ctTag.length - AES_GCM_TAG_BYTES);
  const tag = ctTag.slice(ctTag.length - AES_GCM_TAG_BYTES);
  const packed = new Uint8Array(iv.length + tag.length + ct.length);
  packed.set(iv, 0);
  packed.set(tag, iv.length);
  packed.set(ct, iv.length + tag.length);
  return {
    symbol,
    cachedAt: '2026-05-12T00:00:00Z',
    payloadCiphertext: bytesToBase64(packed),
    payloadKeyId,
  };
}

describe('encryptedExchangeSnapshotSchema', () => {
  test('parses a representative payload', () => {
    const parsed = encryptedExchangeSnapshotSchema.parse({
      account: {
        id: 'acct-1',
        exchange: 'binance',
        displayName: 'Binance · Account 1',
        icon: 'https://logos.example/binance.png',
      },
      payloadKeys: [
        {
          id: 'k1',
          scope: 'exchange_balance:acct-1:123',
          wrappedSek: 'AAAA',
          algorithm: PHASE3_ALGORITHM,
        },
      ],
      balances: [],
      assets: [],
      rateLimitInfo: { remaining: 4, limit: 5, limitReached: false },
      _cacheSource: 'From cache',
    });
    expect(parsed.account.id).toBe('acct-1');
    expect(parsed._cacheSource).toBe('From cache');
  });

  test('parses rate-limit fallback metadata', () => {
    const parsed = encryptedExchangeSnapshotSchema.parse({
      account: {
        id: 'acct-1',
        exchange: 'binance',
        displayName: 'Binance · Account 1',
        icon: '',
      },
      payloadKeys: [],
      balances: [],
      assets: [],
      rateLimitInfo: { remaining: 0, limit: 5, limitReached: true },
      _cacheSource: 'Daily refresh limit reached, showing last synced data',
      _limitReached: true,
      _message: 'Quota exhausted',
    });
    expect(parsed._limitReached).toBe(true);
    expect(parsed._message).toBe('Quota exhausted');
  });
});

describe('fetchExchangeSnapshot (round-trip via mocked transport)', () => {
  test('decrypts balance + asset payloads back to plaintext', async () => {
    await sodium.ready;
    const kp = sodium.crypto_box_keypair();
    setCryptoSession({
      x25519PrivateKey: kp.privateKey,
      x25519PublicKeyBase64: sodium.to_base64(kp.publicKey, sodium.base64_variants.ORIGINAL),
      dekWrapKey: new Uint8Array(32),
      localCacheKey: new Uint8Array(32),
    });

    try {
      const balancesSek = new Uint8Array(32).fill(0x55);
      const assetsSek = new Uint8Array(32).fill(0xaa);
      const wrappedBalances = await sealedBoxSeal(balancesSek, kp.publicKey);
      const wrappedAssets = await sealedBoxSeal(assetsSek, kp.publicKey);

      const balancePayload: BalancePayload = { free: 1, used: 0.5, total: 1.5 };
      const assetPayload: AssetPayload = { holdings: 1.5, price: 3000, value: 4500, percentageOfTotal: 100 };

      const envelope = encryptedExchangeSnapshotSchema.parse({
        account: {
          id: 'acct-1',
          exchange: 'binance',
          displayName: 'Binance · Test',
          icon: '',
        },
        payloadKeys: [
          {
            id: 'kb',
            scope: 'exchange_balance:acct-1',
            wrappedSek: wrappedBalances,
            algorithm: PHASE3_ALGORITHM,
          },
          {
            id: 'ka',
            scope: 'exchange_asset:acct-1',
            wrappedSek: wrappedAssets,
            algorithm: PHASE3_ALGORITHM,
          },
        ],
        balances: [buildRow(balancePayload, balancesSek, 'kb', 'ETH')],
        assets: [buildRow(assetPayload, assetsSek, 'ka', 'ETH')],
      });

      // Replicate the decryption pipeline that lives in client.ts so this
      // test doesn't need a network mock. The pipeline itself is tested via
      // envelope.test.ts; here we verify schema validation + plaintext shape.
      const { decryptEnvelopeRows } = await import('../../../crypto/envelope');
      const balancesResult = await decryptEnvelopeRows<BalancePayload, (typeof envelope.balances)[number]>(
        envelope.payloadKeys,
        envelope.balances,
      );
      const assetsResult = await decryptEnvelopeRows<AssetPayload, (typeof envelope.assets)[number]>(
        envelope.payloadKeys,
        envelope.assets,
      );

      expect(balancesResult.failed.length).toBe(0);
      expect(assetsResult.failed.length).toBe(0);
      expect(balancesResult.decrypted[0].payload).toEqual(balancePayload);
      expect(assetsResult.decrypted[0].payload).toEqual(assetPayload);
    } finally {
      clearCryptoSession();
    }
  });
});
