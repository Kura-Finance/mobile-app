import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────
// Sub-schemas
// ─────────────────────────────────────────────────────────────────

export const kycStatusSchema = z
  .enum(['not_started', 'pending', 'under_review', 'approved', 'rejected'])
  .catch('not_started');
export type KycStatus = z.infer<typeof kycStatusSchema>;

export const cardStatusSchema = z
  .enum(['unavailable', 'applying', 'issued', 'active', 'frozen', 'cancelled'])
  .catch('unavailable');
export type CardStatus = z.infer<typeof cardStatusSchema>;

// ─────────────────────────────────────────────────────────────────
// GET /api/card/status
// ─────────────────────────────────────────────────────────────────

export const cardStatusResponseSchema = z.object({
  kyc: z.object({
    status: kycStatusSchema,
    submittedAt: z.string().nullable().optional(),
    reviewedAt: z.string().nullable().optional(),
    rejectionReason: z.string().nullable().optional(),
  }),
  card: z.object({
    status: cardStatusSchema,
    last4: z.string().nullable().optional(),
    expiryMmYy: z.string().nullable().optional(),
    isVirtual: z.boolean(),
    isPhysical: z.boolean(),
    frozenAt: z.string().nullable().optional(),
  }),
  spending: z.object({
    dailyLimit: z.number(),
    dailySpent: z.number(),
    monthlyLimit: z.number(),
    monthlySpent: z.number(),
    currency: z.literal('USDC'),
  }),
  wallet: z.object({
    linkedAddress: z.string().nullable().optional(),
    sessionKeyExpiry: z.string().nullable().optional(),
    sessionKeyDailyLimit: z.number().nullable().optional(),
  }),
});
export type CardStatusResponse = z.infer<typeof cardStatusResponseSchema>;

// ─────────────────────────────────────────────────────────────────
// POST /api/card/kyc/start
// ─────────────────────────────────────────────────────────────────

export const kycStartResponseSchema = z.object({
  sessionToken: z.string(),
  provider: z.enum(['didit', 'persona', 'jumio']),
  /** true when the backend returned an existing pending session rather than creating a new one */
  resumed: z.boolean().optional(),
});
export type KycStartResponse = z.infer<typeof kycStartResponseSchema>;

// ─────────────────────────────────────────────────────────────────
// POST /api/card/wallet/link
// ─────────────────────────────────────────────────────────────────

export const linkWalletRequestSchema = z.object({
  address: z.string(),
  /** SIWE signature proving ownership of `address` */
  signature: z.string(),
  sessionKeyConfig: z.object({
    publicKey: z.string(),
    dailyLimitUsdc: z.number(),
    expiryTimestamp: z.number(),
    allowedContracts: z.array(z.string()),
  }),
  sessionKeySignature: z.string(),
});
export type LinkWalletRequest = z.infer<typeof linkWalletRequestSchema>;

export const linkWalletResponseSchema = z.object({
  linked: z.boolean(),
  walletAddress: z.string(),
});

// ─────────────────────────────────────────────────────────────────
// POST /api/card/topup
// ─────────────────────────────────────────────────────────────────

export const topUpRequestSchema = z.object({
  amountUsdc: z.number(),
  txHash: z.string(),
});
