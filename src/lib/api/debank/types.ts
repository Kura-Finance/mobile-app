/**
 * Plaintext (UI-friendly) DeBank types after normalisation.
 */

import type { ApiCacheMetadata } from '../cacheMetadata';
import type { RateLimitInfo } from '../exchange/schemas';

export type { RateLimitInfo };

export interface DeBankToken {
  /** Stable id; falls back to `${chain}-${symbol}` if upstream omits one. */
  id: string;
  symbol: string;
  name: string;
  amount: number;
  price: number;
  /** Logo URL or empty string. */
  logo: string;
  chain: string;
  /** DeBank `protocol_id` when this row is a protocol receipt / mint token. */
  protocolId: string;
  /** DeBank `is_wallet` — false for protocol-only representations. */
  isWallet: boolean;
  /** UTC ISO timestamp the row was cached on the backend. */
  cachedAt: string;
}

export interface DeBankProtocolAsset {
  id: string;
  symbol: string;
  name: string;
  amount: number;
  price: number;
  usdValue: number;
  logo: string;
}

export interface DeBankProtocolPortfolioItem {
  type: string;
  tokens: DeBankProtocolAsset[];
  usdValue: number;
}

export interface DeBankProtocol {
  /** Stable id; aligns with the backend `protocolId` row key. */
  id: string;
  name: string;
  netUsdValue: number;
  assetUsdValue: number;
  debtUsdValue: number;
  chain: string;
  logo: string;
  siteUrl: string;
  portfolioItems: DeBankProtocolPortfolioItem[];
  cachedAt: string;
}

export interface DeBankProtocolsResult extends ApiCacheMetadata {
  address: string;
  protocols: DeBankProtocol[];
  total: number;
  decryptionFailureCount: number;
  rateLimitInfo?: RateLimitInfo;
}

export interface DeBankTokensResult extends ApiCacheMetadata {
  address: string;
  tokens: DeBankToken[];
  total: number;
  decryptionFailureCount: number;
  rateLimitInfo?: RateLimitInfo;
}

export interface UnlinkDeBankAddressResult {
  address: string;
  unlinked: true;
  deletedProtocolCount: number;
  deletedTokenCount: number;
}
