/**
 * Gnosis Pay API client — backend-proxied
 *
 * All calls go to https://api.kura-finance.com/api/card/...
 * The backend holds the GP JWT and forwards to Gnosis Pay.
 * No GP token management on the frontend.
 *
 * Backend responds with { data: T } envelopes (already unwrapped by requestJson).
 *
 * Special error: HTTP 401 with code "GP_SESSION_EXPIRED" means the backend's
 * GP session has expired — the user must re-do SIWE (Step 1).
 *
 * Docs: https://docs.gnosispay.com
 */

import { requestJson } from '../client';
import { KuraApiError } from '../errors';
import Logger from '../../../shared/utils/Logger';

const TAG = 'GnosisPayApi';

// ─────────────────────────────────────────────────────────────────────────────
// Error sentinel
// ─────────────────────────────────────────────────────────────────────────────

export const GP_SESSION_EXPIRED_CODE = 'GP_SESSION_EXPIRED';

export function isGpSessionExpired(err: unknown): boolean {
  return err instanceof KuraApiError && err.code === GP_SESSION_EXPIRED_CODE;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — SIWE auth
// ─────────────────────────────────────────────────────────────────────────────

export interface GpNonceResponse {
  nonce: string;
  /** Pre-formatted EIP-4361 message — just sign this directly */
  message: string;
}

/**
 * GET /api/card/gp/nonce?address=0x...
 * Backend returns both the nonce and the pre-built SIWE message.
 */
export async function getGpNonce(address: string): Promise<GpNonceResponse> {
  Logger.debug(TAG, 'getGpNonce', { address });
  return requestJson<GpNonceResponse>(`/api/card/gp/nonce?address=${address}`, {
    method: 'GET',
    apiName: TAG,
  });
}

export interface GpAuthResponse {
  address: string;
}

/**
 * POST /api/card/gp/auth
 * Sends the signed SIWE message; backend stores the GP JWT.
 */
export async function gpAuth(body: {
  message: string;
  signature: string;
}): Promise<GpAuthResponse> {
  Logger.debug(TAG, 'gpAuth', { messagePrefix: body.message.slice(0, 40) });
  return requestJson<GpAuthResponse>('/api/card/gp/auth', {
    method: 'POST',
    body: JSON.stringify(body),
    apiName: TAG,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Signup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/card/gp/signup
 * Registers the user's email with Gnosis Pay via the backend.
 */
export async function gpSignup(email: string): Promise<void> {
  await requestJson<unknown>('/api/card/gp/signup', {
    method: 'POST',
    body: JSON.stringify({ email }),
    apiName: TAG,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Terms
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/card/gp/terms */
export async function gpAcceptTerms(): Promise<void> {
  await requestJson<unknown>('/api/card/gp/terms', {
    method: 'POST',
    apiName: TAG,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 4 — KYC (Sumsub)
// ─────────────────────────────────────────────────────────────────────────────

export interface GpKycTokenResponse {
  token: string;
}

/** GET /api/card/gp/kyc/sdk-token */
export async function getGpKycSdkToken(): Promise<GpKycTokenResponse> {
  return requestJson<GpKycTokenResponse>('/api/card/gp/kyc/sdk-token', {
    method: 'GET',
    apiName: TAG,
  });
}

/**
 * Full Sumsub URL to load in the onboarding WebView.
 *
 * Mirrors the direct client's getGpKycUrl() so the hook/screen can load a URL
 * directly. Preserves the existing backend behaviour (the idensic link built
 * from the SDK token).
 */
export async function getGpKycUrl(): Promise<{ url: string }> {
  const { token } = await getGpKycSdkToken();
  return { url: `https://api.sumsub.com/idensic/l/#/${encodeURIComponent(token)}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Status (used for KYC polling and onboarding resumption)
// ─────────────────────────────────────────────────────────────────────────────

export type GpKycStatus = 'not_started' | 'pending' | 'approved' | 'rejected';
export type GpCardStatus = 'active' | 'frozen' | 'cancelled' | 'issuing' | null;

export interface GpOnboardingStatus {
  /** Whether the user has authenticated with GP (SIWE done) */
  gpAuthenticated: boolean;
  /** Email registered with GP */
  email?: string;
  termsAccepted: boolean;
  kycStatus: GpKycStatus;
  sofSubmitted: boolean;
  phoneVerified: boolean;
  safeAddress?: string;
  safeReady: boolean;
  hasCard: boolean;
  card?: {
    id: string;
    last4: string;
    status: GpCardStatus;
    isVirtual: boolean;
  };
  spending?: {
    monthlySpent: number;
    dailySpent: number;
    dailyLimit: number;
    currency: string;
  };
}

/**
 * GET /api/card/status
 * Full onboarding state + card + spending — used on mount to resume where left off.
 */
export async function getGpCardStatus(): Promise<GpOnboardingStatus> {
  return requestJson<GpOnboardingStatus>('/api/card/status', {
    method: 'GET',
    apiName: TAG,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 5 — Source of Funds
// ─────────────────────────────────────────────────────────────────────────────

export type GpSofSource =
  | 'employment'
  | 'self_employment'
  | 'savings'
  | 'investments'
  | 'inheritance'
  | 'other';

/** POST /api/card/gp/sof */
export async function gpSubmitSof(sourceOfFunds: GpSofSource): Promise<void> {
  await requestJson<unknown>('/api/card/gp/sof', {
    method: 'POST',
    body: JSON.stringify({ sourceOfFunds }),
    apiName: TAG,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 6 — Phone verification
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/card/gp/phone/send */
export async function gpSendPhoneOtp(phone: string): Promise<void> {
  await requestJson<unknown>('/api/card/gp/phone/send', {
    method: 'POST',
    body: JSON.stringify({ phone }),
    apiName: TAG,
  });
}

/** POST /api/card/gp/phone/verify */
export async function gpVerifyPhoneOtp(code: string): Promise<void> {
  await requestJson<unknown>('/api/card/gp/phone/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
    apiName: TAG,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 7 — Gnosis Safe deployment
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/card/gp/safe/deploy — initiates deployment (202 response) */
export async function gpDeploySafe(): Promise<void> {
  await requestJson<unknown>('/api/card/gp/safe/deploy', {
    method: 'POST',
    apiName: TAG,
  });
}

export interface GpSafeStatusResponse {
  safeAddress?: string;
  accountStatus: number;
  currency: string;
  ready: boolean;
}

/** GET /api/card/gp/safe/status — poll until ready: true */
export async function getGpSafeStatus(): Promise<GpSafeStatusResponse> {
  return requestJson<GpSafeStatusResponse>('/api/card/gp/safe/status', {
    method: 'GET',
    apiName: TAG,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 8 — Virtual card issuance
// ─────────────────────────────────────────────────────────────────────────────

export interface GpVirtualCard {
  id: string;
  last4: string;
  status: GpCardStatus;
  isVirtual: boolean;
}

/** POST /api/card/cards/virtual */
export async function issueGpVirtualCard(): Promise<GpVirtualCard> {
  const res = await requestJson<{ card: GpVirtualCard }>('/api/card/cards/virtual', {
    method: 'POST',
    apiName: TAG,
  });
  return res.card;
}

// ─────────────────────────────────────────────────────────────────────────────
// Post-onboarding — transactions
// ─────────────────────────────────────────────────────────────────────────────

export interface GpTransaction {
  id: string;
  amount: number;
  currency: string;
  merchant?: string;
  status: string;
  createdAt: string;
}

/** GET /api/card/transactions */
export async function getGpTransactions(): Promise<GpTransaction[]> {
  const res = await requestJson<GpTransaction[] | { transactions: GpTransaction[] }>(
    '/api/card/transactions',
    { method: 'GET', apiName: TAG },
  );
  return Array.isArray(res) ? res : res.transactions ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Card actions
// ─────────────────────────────────────────────────────────────────────────────

export async function freezeGpCard(cardId: string): Promise<void> {
  await requestJson<unknown>(`/api/card/cards/${cardId}/freeze`, {
    method: 'POST',
    apiName: TAG,
  });
}

export async function unfreezeGpCard(cardId: string): Promise<void> {
  await requestJson<unknown>(`/api/card/cards/${cardId}/unfreeze`, {
    method: 'POST',
    apiName: TAG,
  });
}

/** PUT /api/card/gp/daily-limit — backend signs and submits the on-chain limit update */
export async function setGpDailyLimit(dailyLimit: number): Promise<void> {
  await requestJson<unknown>('/api/card/gp/daily-limit', {
    method: 'PUT',
    body: JSON.stringify({ dailyLimit }),
    apiName: TAG,
  });
}
