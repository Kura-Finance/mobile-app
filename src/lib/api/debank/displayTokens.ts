/**
 * Spot-token visibility rules for the DeBank portfolio UI.
 *
 * Wallet totals include every backend row (see portfolioTotals), but the token
 * list hides dust to reduce noise. Native gas tokens (e.g. ETH on Base) are
 * always shown when present — they are easy to miss and explain total mismatches.
 */

import type { DeBankToken } from './types';

/** Hide spot tokens below this USD value (except native gas). */
export const MIN_DISPLAY_TOKEN_USD = 0.01;

type TokenLike = Pick<DeBankToken, 'id' | 'symbol' | 'chain' | 'amount' | 'price'>;

/**
 * DeBank native gas tokens use the chain slug as `id` (e.g. Base ETH → id "base").
 * L1 Ethereum native uses id "eth".
 */
export function isNativeChainToken(token: TokenLike): boolean {
  const id = token.id.toLowerCase();
  const chain = token.chain.toLowerCase();
  const symbol = token.symbol.toUpperCase();

  if (id === chain) return true;
  if (id === 'eth' && symbol === 'ETH') return true;

  const nativeByChain: Record<string, string> = {
    bsc: 'BNB',
    matic: 'MATIC',
    avax: 'AVAX',
    ftm: 'FTM',
    op: 'ETH',
    arb: 'ETH',
    base: 'ETH',
  };
  const expected = nativeByChain[chain];
  return Boolean(expected && symbol === expected && (id === chain || id === 'eth'));
}

export function tokenUsdValue(token: TokenLike): number {
  return token.amount * token.price;
}

export function shouldDisplaySpotToken(token: TokenLike): boolean {
  const usd = tokenUsdValue(token);
  if (isNativeChainToken(token)) {
    return token.amount > 0 || usd > 0;
  }
  return usd >= MIN_DISPLAY_TOKEN_USD;
}

export function filterSpotTokensForDisplay<T extends TokenLike>(tokens: T[]): T[] {
  return tokens.filter(shouldDisplaySpotToken);
}
