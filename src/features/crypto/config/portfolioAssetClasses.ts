import type { AssetClass } from '../components/AssetClassToggle';
import type { PortfolioToken } from '../hooks/usePortfolio';

/** USD / EUR stablecoins on Base. */
export const STABLECOIN_SYMBOLS = new Set(['USDC', 'DAI', 'EURC']);

export function isStablecoinSymbol(symbol: string): boolean {
  return STABLECOIN_SYMBOLS.has(symbol.toUpperCase());
}

export function isCryptoSymbol(symbol: string): boolean {
  return !STABLECOIN_SYMBOLS.has(symbol.toUpperCase());
}

export function filterPortfolioByAssetClass(
  tokens: PortfolioToken[],
  assetClass: AssetClass,
): PortfolioToken[] {
  switch (assetClass) {
    case 'stablecoin':
      return tokens.filter((t) => isStablecoinSymbol(t.token.symbol));
    case 'crypto':
      return tokens.filter((t) => isCryptoSymbol(t.token.symbol));
    default:
      return [];
  }
}

export function isTokenAssetClass(assetClass: AssetClass): boolean {
  return assetClass === 'stablecoin' || assetClass === 'crypto';
}
