/**
 * Wire schemas for `/api/debank/*`.
 *
 * Source of truth: BackendServer/src/domains/debank/services/debankService.ts
 *   - `EncryptedDeBankProtocolSnapshot`
 *   - `EncryptedDeBankTokenSnapshot`
 *
 * Decrypted row payloads:
 *   - protocols: `{ name: string, rawData: DeBankProtocolPosition }`
 *   - tokens:    `{ symbol: string, name: string, rawData: DeBankTokenPosition }`
 *
 * `rawData` is the unmodified DeBank OpenAPI response; we normalise it in
 * `./normalize.ts` because the upstream shape is sprawling.
 */

import { z } from 'zod';
import { apiCacheMetadataSchema } from '../cacheMetadata';
import { rateLimitInfoSchema } from '../exchange/schemas';
import { payloadKeyEnvelopeSchema } from '../plaid/schemas';

const cipherFields = {
  payloadCiphertext: z.string(),
  payloadKeyId: z.string(),
};

// ─────────────────────────────────────────────────────────────
// Protocol snapshot
// ─────────────────────────────────────────────────────────────

export const encryptedDeBankProtocolRowSchema = z.object({
  protocolId: z.string(),
  chain: z.string(),
  cachedAt: z.string(),
  ...cipherFields,
});
export type EncryptedDeBankProtocolRow = z.infer<typeof encryptedDeBankProtocolRowSchema>;

export const encryptedDeBankProtocolSnapshotSchema = apiCacheMetadataSchema.extend({
  address: z.string(),
  payloadKeys: z.array(payloadKeyEnvelopeSchema),
  protocols: z.array(encryptedDeBankProtocolRowSchema),
  total: z.number(),
  rateLimitInfo: rateLimitInfoSchema.optional(),
});
export type EncryptedDeBankProtocolSnapshotV1 = z.infer<typeof encryptedDeBankProtocolSnapshotSchema>;

/** Inner payload schema — `rawData` is intentionally `unknown` (DeBank shape). */
export const debankProtocolPayloadSchema = z.object({
  name: z.string(),
  rawData: z.unknown(),
});
export type DeBankProtocolPayload = z.infer<typeof debankProtocolPayloadSchema>;

// ─────────────────────────────────────────────────────────────
// Token snapshot
// ─────────────────────────────────────────────────────────────

export const encryptedDeBankTokenRowSchema = z.object({
  tokenId: z.string(),
  chain: z.string(),
  cachedAt: z.string(),
  ...cipherFields,
});
export type EncryptedDeBankTokenRow = z.infer<typeof encryptedDeBankTokenRowSchema>;

export const encryptedDeBankTokenSnapshotSchema = apiCacheMetadataSchema.extend({
  address: z.string(),
  payloadKeys: z.array(payloadKeyEnvelopeSchema),
  tokens: z.array(encryptedDeBankTokenRowSchema),
  total: z.number(),
  rateLimitInfo: rateLimitInfoSchema.optional(),
});
export type EncryptedDeBankTokenSnapshotV1 = z.infer<typeof encryptedDeBankTokenSnapshotSchema>;

export const debankTokenPayloadSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  rawData: z.unknown(),
});
export type DeBankTokenPayload = z.infer<typeof debankTokenPayloadSchema>;

// ─────────────────────────────────────────────────────────────
// Unlink
// ─────────────────────────────────────────────────────────────

export const unlinkDebankAddressResponseSchema = z.object({
  address: z.string(),
  unlinked: z.boolean(),
  deletedProtocolCount: z.number(),
  deletedTokenCount: z.number(),
});
export type UnlinkDebankAddressResponseV1 = z.infer<typeof unlinkDebankAddressResponseSchema>;
