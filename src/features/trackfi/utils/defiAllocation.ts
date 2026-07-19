/**
 * DeFi asset allocation buckets for the TrackFi DeFi screen.
 *
 * - Stablecoins: wallet spot stablecoins (non-protocol or zero-net protocol)
 * - Crypto: all other non-protocol spot tokens
 * - Yield Tokens: DeFi protocol positions + yield-style spot tokens
 * - Other: rounding / uncategorized remainder
 */

import {
  effectiveProtocolDisplayUsd,
  shouldIncludeSpotTokenInAllocation,
} from '../../../lib/api/debank/portfolioTotals';
import type { DefiToken, WalletData } from '../hooks/useDefiPortfolio';

const STABLE = new Set(['USDC', 'USDT', 'DAI', 'USDBC', 'FRAX', 'LUSD', 'USDE', 'USD+', 'EURC']);

export type DefiAllocationBucketId = 'stablecoins' | 'crypto' | 'yield' | 'other';

function isYieldSpotToken(token: DefiToken): boolean {
  const sym = token.symbol.toUpperCase();
  if (token.name.toLowerCase().includes('yield')) return true;
  if (/^K[A-Z]{2}USDC/i.test(sym)) return true;
  if (sym.startsWith('A') && sym.endsWith('TOKEN')) return true;
  return false;
}

function spotTokenBucket(token: DefiToken): 'stablecoins' | 'crypto' | 'yield' {
  const sym = token.symbol.toUpperCase();
  if (STABLE.has(sym)) return 'stablecoins';
  if (isYieldSpotToken(token)) return 'yield';
  return 'crypto';
}

export function computeDefiAllocationBuckets(
  walletRows: WalletData[],
  portfolioTotalUsd: number,
): Record<DefiAllocationBucketId, number> {
  const buckets: Record<DefiAllocationBucketId, number> = {
    stablecoins: 0,
    crypto: 0,
    yield: 0,
    other: 0,
  };

  for (const wallet of walletRows) {
    for (const token of wallet.tokens) {
      if (
        !shouldIncludeSpotTokenInAllocation(
          { protocolId: token.protocolId, symbol: token.symbol },
          wallet.protocols,
        )
      ) continue;
      buckets[spotTokenBucket(token)] += token.usdValue;
    }
    for (const protocol of wallet.protocols) {
      const protocolUsd = effectiveProtocolDisplayUsd(protocol);
      if (protocolUsd !== 0) {
        buckets.yield += protocolUsd;
      }
    }
  }

  const bucketSum = Object.values(buckets).reduce((s, v) => s + v, 0);
  const remainder = portfolioTotalUsd - bucketSum;
  if (remainder > 0.01) {
    buckets.other += remainder;
  }

  return buckets;
}
