/**
 * Plaintext (decrypted) types consumed by the store + UI.
 */

import type { ApiCacheMetadata } from '../cacheMetadata';
import type { AssetPayload, BalancePayload, RateLimitInfo } from './schemas';

export interface ExchangeAccount {
  id: string;
  exchange: string;
  exchangeDisplayName: string;
  icon: string;
  isVerified: boolean;
  isActive?: boolean;
  lastVerifiedAt?: string;
}

export interface ExchangeBalance extends BalancePayload {
  symbol: string;
  cachedAt: string;
}

export interface ExchangeAsset extends AssetPayload {
  symbol: string;
  cachedAt: string;
}

export interface ExchangeSnapshot extends ApiCacheMetadata {
  account: {
    id: string;
    exchange: string;
    displayName: string;
    icon: string;
  };
  balances: ExchangeBalance[];
  assets: ExchangeAsset[];
  /** Sum of `value` across all assets — total USD spot value for this account. */
  assetsUsdTotal: number;
  rateLimitInfo?: RateLimitInfo;
  /** Number of rows that failed decryption — usually 0. */
  decryptionFailureCount: number;
}

export interface ExchangeCredentials {
  exchange: string;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

