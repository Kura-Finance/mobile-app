/**
 * Wire-level zod schemas for the Phase 3 encrypted Plaid endpoint.
 *
 * Source of truth: BackendServer/src/domains/plaid/lib/plaidPayloadBuilder.ts
 * (Account/Transaction/InvestmentAccount/Investment Metadata + Sensitive).
 *
 * Each row carries `payloadCiphertext` + `payloadKeyId`; the metadata fields
 * are plain (server needs them for dedup/refresh/etc) so we keep them in the
 * decrypted view directly.
 */

import { z } from 'zod';
import { apiCacheMetadataSchema } from '../cacheMetadata';

// ─────────────────────────────────────────────────────────────
// Envelope-level
// ─────────────────────────────────────────────────────────────

export const payloadKeyEnvelopeSchema = z.object({
  id: z.string(),
  scope: z.string(),
  wrappedSek: z.string(),
  algorithm: z.string(),
});
export type PayloadKeyEnvelopeV1 = z.infer<typeof payloadKeyEnvelopeSchema>;

const cipherFields = {
  payloadCiphertext: z.string(),
  payloadKeyId: z.string(),
};

// ─────────────────────────────────────────────────────────────
// Account
// ─────────────────────────────────────────────────────────────

export const encryptedAccountRowSchema = z.object({
  accountId: z.string(),
  plaidItemId: z.string().nullable(),
  type: z.string(),
  bucket: z.string(),
  cachedAt: z.string(),
  ...cipherFields,
});
export type EncryptedAccountRow = z.infer<typeof encryptedAccountRowSchema>;

export const accountSensitiveSchema = z.object({
  name: z.string(),
  balance: z.number(),
  institutionName: z.string(),
  logo: z.string(),
  plaidLogo: z.string().optional(),
  apy: z.number().optional(),
  mask: z.string().optional(),
});
export type AccountSensitive = z.infer<typeof accountSensitiveSchema>;

// ─────────────────────────────────────────────────────────────
// Transaction
// ─────────────────────────────────────────────────────────────

export const encryptedTransactionRowSchema = z.object({
  transactionId: z.string(),
  accountId: z.string(),
  plaidItemId: z.string().nullable(),
  date: z.string(),
  month: z.string(),
  isPending: z.boolean(),
  isRecurring: z.boolean(),
  isSubscription: z.boolean(),
  cachedAt: z.string(),
  ...cipherFields,
});
export type EncryptedTransactionRow = z.infer<typeof encryptedTransactionRowSchema>;

export const transactionSensitiveSchema = z.object({
  amount: z.string(),
  merchant: z.string(),
  category: z.string(),
  type: z.string(),
  personalFinanceCategory: z.string().optional(),
  recurringFrequency: z.string().optional(),
  enrichedMerchantName: z.string().optional(),
  merchantLogo: z.string().optional(),
  plaidMerchantLogo: z.string().optional(),
  merchantCategory: z.string().optional(),
  accountName: z.string().optional(),
  accountType: z.string().optional(),
});
export type TransactionSensitive = z.infer<typeof transactionSensitiveSchema>;

// ─────────────────────────────────────────────────────────────
// Investment Account
// ─────────────────────────────────────────────────────────────

export const encryptedInvestmentAccountRowSchema = z.object({
  accountId: z.string(),
  cachedAt: z.string(),
  ...cipherFields,
});
export type EncryptedInvestmentAccountRow = z.infer<typeof encryptedInvestmentAccountRowSchema>;

export const investmentAccountSensitiveSchema = z.object({
  name: z.string(),
  institutionName: z.string(),
  logo: z.string(),
  plaidLogo: z.string().optional(),
});
export type InvestmentAccountSensitive = z.infer<typeof investmentAccountSensitiveSchema>;

// ─────────────────────────────────────────────────────────────
// Investment Holding
// ─────────────────────────────────────────────────────────────

export const encryptedInvestmentRowSchema = z.object({
  investmentId: z.string(),
  accountId: z.string(),
  type: z.string(),
  cachedAt: z.string(),
  ...cipherFields,
});
export type EncryptedInvestmentRow = z.infer<typeof encryptedInvestmentRowSchema>;

export const investmentSensitiveSchema = z.object({
  symbol: z.string(),
  name: z.string(),
  holdings: z.number(),
  currentPrice: z.number(),
  change24h: z.number().optional(),
  logo: z.string(),
});
export type InvestmentSensitive = z.infer<typeof investmentSensitiveSchema>;

// ─────────────────────────────────────────────────────────────
// Full envelope
// ─────────────────────────────────────────────────────────────

export const encryptedFinanceSnapshotSchema = apiCacheMetadataSchema.extend({
  payloadKeys: z.array(payloadKeyEnvelopeSchema),
  accounts: z.array(encryptedAccountRowSchema),
  transactions: z.array(encryptedTransactionRowSchema),
  investmentAccounts: z.array(encryptedInvestmentAccountRowSchema),
  investments: z.array(encryptedInvestmentRowSchema),
  lastSyncedAt: z.string().nullable(),
});
export type EncryptedFinanceSnapshotV1 = z.infer<typeof encryptedFinanceSnapshotSchema>;
