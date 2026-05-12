/**
 * Wire schemas for `/api/exchange/*`.
 *
 * Source of truth: BackendServer/src/domains/exchange/services/exchangeService.ts
 *   - `EncryptedExchangeSnapshot`
 *   - balance payload   = { free, used, total }
 *   - asset payload     = { holdings, price, value, percentageOfTotal }
 *
 * Phase 3 row layout matches plaid's: `payloadCiphertext` + `payloadKeyId`,
 * envelope decrypted via the shared `decryptEnvelopeRows` helper.
 */

import { z } from 'zod';
import { apiCacheMetadataSchema } from '../cacheMetadata';
import { payloadKeyEnvelopeSchema } from '../plaid/schemas';

export const KURA_SUPPORTED_EXCHANGE_IDS = [
  'binance',
  'kraken',
  'coinbase',
  'okx',
  'huobi',
  'bybit',
  'kucoin',
  'bitget',
  'gateio',
] as const;
export type ExchangeName = (typeof KURA_SUPPORTED_EXCHANGE_IDS)[number];

export const supportedExchangeSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  requiresPassphrase: z.boolean(),
  icon: z.string(),
  website: z.string(),
});
export type SupportedExchange = z.infer<typeof supportedExchangeSchema>;

export const supportedExchangesResponseSchema = z.object({
  exchanges: z.array(supportedExchangeSchema),
  metadata: z
    .object({
      timestamp: z.string().optional(),
      count: z.number().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

export const exchangeAccountSchema = z.object({
  id: z.string(),
  accountId: z.string().optional(),
  exchange: z.string(),
  exchangeDisplayName: z.string(),
  icon: z.string(),
  isVerified: z.boolean(),
  isActive: z.boolean().optional(),
  lastVerifiedAt: z.string().optional(),
});
export type ExchangeAccountWire = z.infer<typeof exchangeAccountSchema>;

export const rateLimitInfoSchema = z.object({
  remaining: z.number(),
  limit: z.number(),
  limitReached: z.boolean().optional(),
  message: z.string().optional(),
});
export type RateLimitInfo = z.infer<typeof rateLimitInfoSchema>;

export const connectExchangeResponseSchema = z.object({
  account: exchangeAccountSchema,
  rateLimitInfo: rateLimitInfoSchema.optional(),
});

export const exchangeAccountsResponseSchema = z.object({
  accounts: z.array(exchangeAccountSchema),
  metadata: z
    .object({
      timestamp: z.string().optional(),
      count: z.number().optional(),
    })
    .optional(),
});

// ─────────────────────────────────────────────────────────────
// Encrypted balance snapshot
// ─────────────────────────────────────────────────────────────

export const encryptedExchangeRowSchema = z.object({
  symbol: z.string(),
  cachedAt: z.string(),
  payloadCiphertext: z.string(),
  payloadKeyId: z.string(),
});
export type EncryptedExchangeRow = z.infer<typeof encryptedExchangeRowSchema>;

export const encryptedExchangeSnapshotSchema = apiCacheMetadataSchema.extend({
  account: z.object({
    id: z.string(),
    exchange: z.string(),
    displayName: z.string(),
    icon: z.string(),
  }),
  payloadKeys: z.array(payloadKeyEnvelopeSchema),
  balances: z.array(encryptedExchangeRowSchema),
  assets: z.array(encryptedExchangeRowSchema),
  rateLimitInfo: rateLimitInfoSchema.optional(),
});
export type EncryptedExchangeSnapshotV1 = z.infer<typeof encryptedExchangeSnapshotSchema>;

// Decrypted row payload schemas
export const balancePayloadSchema = z.object({
  free: z.number(),
  used: z.number(),
  total: z.number(),
});
export type BalancePayload = z.infer<typeof balancePayloadSchema>;

export const assetPayloadSchema = z.object({
  holdings: z.number(),
  price: z.number(),
  value: z.number(),
  percentageOfTotal: z.number(),
});
export type AssetPayload = z.infer<typeof assetPayloadSchema>;
