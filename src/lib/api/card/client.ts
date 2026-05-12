import { requestJson } from '../client';
import {
  cardStatusResponseSchema,
  kycStartResponseSchema,
  linkWalletResponseSchema,
  type CardStatusResponse,
  type KycStartResponse,
  type LinkWalletRequest,
} from './schemas';

const apiName = 'CardApi';

// ─────────────────────────────────────────────────────────────────
// GET /api/card/status
// ─────────────────────────────────────────────────────────────────

export async function fetchCardStatus(): Promise<CardStatusResponse> {
  const raw = await requestJson<unknown>('/api/card/status', {
    method: 'GET',
    apiName,
  });
  return cardStatusResponseSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────
// POST /api/card/kyc/start
// ─────────────────────────────────────────────────────────────────

export async function startKyc(): Promise<KycStartResponse> {
  const raw = await requestJson<unknown>('/api/card/kyc/start', {
    method: 'POST',
    apiName,
  });
  return kycStartResponseSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────
// POST /api/card/wallet/link
// ─────────────────────────────────────────────────────────────────

export async function linkWallet(body: LinkWalletRequest): Promise<{ linked: boolean; walletAddress: string }> {
  const raw = await requestJson<unknown>('/api/card/wallet/link', {
    method: 'POST',
    body: JSON.stringify(body),
    apiName,
  });
  return linkWalletResponseSchema.parse(raw);
}

// ─────────────────────────────────────────────────────────────────
// POST /api/card/topup
// ─────────────────────────────────────────────────────────────────

export async function recordTopUp(amountUsdc: number, txHash: string): Promise<void> {
  await requestJson<unknown>('/api/card/topup', {
    method: 'POST',
    body: JSON.stringify({ amountUsdc, txHash }),
    apiName,
  });
}

// ─────────────────────────────────────────────────────────────────
// POST /api/card/freeze  /  POST /api/card/unfreeze
// ─────────────────────────────────────────────────────────────────

export async function freezeCard(): Promise<void> {
  await requestJson<unknown>('/api/card/freeze', { method: 'POST', apiName });
}

export async function unfreezeCard(): Promise<void> {
  await requestJson<unknown>('/api/card/unfreeze', { method: 'POST', apiName });
}
