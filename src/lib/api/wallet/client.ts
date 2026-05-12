/**
 * Wallet API — /api/wallet domain
 *
 * All endpoints require JWT authentication.
 *
 *   GET  /api/wallet        → { walletAddress, scaAddress }
 *   PUT  /api/wallet/sca    → { scaAddress: "0x..." }
 *   PUT  /api/wallet/eoa    → { walletAddress: "0x..." }
 */

import { requestJson, requestJsonAllowing } from '../client';
import { KuraApiError } from '../errors';

const apiName = 'WalletApi';

export interface WalletRecord {
  /** Privy embedded EOA address */
  walletAddress: string | null;
  /** Safe Smart Account (ERC-4337) address */
  scaAddress: string | null;
}

/**
 * Fetch stored wallet addresses for the authenticated user.
 * Returns nulls if not registered yet (404 → empty record).
 */
export async function fetchWalletRecord(): Promise<WalletRecord> {
  try {
    return await requestJsonAllowing<WalletRecord>(
      '/api/wallet',
      { method: 'GET', apiName },
      (err: KuraApiError) =>
        err.status === 404 ? { walletAddress: null, scaAddress: null } : null,
    );
  } catch {
    return { walletAddress: null, scaAddress: null };
  }
}

/**
 * Register / update the Safe Smart Account address.
 * Idempotent — safe to call on every provisioning.
 */
export async function saveScaAddress(scaAddress: string): Promise<void> {
  await requestJson<WalletRecord>('/api/wallet/sca', {
    method: 'PUT',
    body: JSON.stringify({ scaAddress }),
    apiName,
  });
}

/**
 * Register / update the Privy embedded EOA address.
 * Called once after the EOA is confirmed to exist.
 */
export async function saveEoaAddress(walletAddress: string): Promise<void> {
  await requestJson<WalletRecord>('/api/wallet/eoa', {
    method: 'PUT',
    body: JSON.stringify({ walletAddress }),
    apiName,
  });
}
