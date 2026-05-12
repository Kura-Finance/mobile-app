/**
 * Wire schemas for `/api/assets/history/encrypted` and `/api/assets/dates`.
 *
 * Source of truth: BackendServer/src/domains/asset/services/assetService.ts
 *   - `EncryptedAssetHistoryResponse`
 *   - `EncryptedAssetSnapshotRow`
 *
 * Each snapshot row decrypts to `{ value: number }`.
 */

import { z } from 'zod';
import { payloadKeyEnvelopeSchema } from '../plaid/schemas';

export const assetSnapshotRowSchema = z.object({
  id: z.string(),
  metric: z.string(),
  recordedAt: z.string(),
  payloadCiphertext: z.string(),
  payloadKeyId: z.string(),
});
export type EncryptedAssetSnapshotRowV1 = z.infer<typeof assetSnapshotRowSchema>;

export const encryptedAssetHistorySchema = z.object({
  userId: z.string(),
  payloadKeys: z.array(payloadKeyEnvelopeSchema),
  snapshots: z.array(assetSnapshotRowSchema),
});
export type EncryptedAssetHistoryResponseV1 = z.infer<typeof encryptedAssetHistorySchema>;

export const assetSnapshotPayloadSchema = z.object({
  value: z.number(),
});
export type AssetSnapshotPayload = z.infer<typeof assetSnapshotPayloadSchema>;

export const recordDatesResponseSchema = z.object({
  dates: z.array(z.string()),
  count: z.number(),
});
export type RecordDatesResponseV1 = z.infer<typeof recordDatesResponseSchema>;
