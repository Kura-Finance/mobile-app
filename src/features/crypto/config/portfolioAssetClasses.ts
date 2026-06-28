import type { AssetClass } from '../components/AssetClassToggle';
import type { PortfolioToken } from '../hooks/usePortfolio';
import type { StockItem } from '../../stocks/hooks/useDinari';
import type { MorphoVault, MorphoVaultPosition } from '../../../lib/api/morpho/client';

/** USD / EUR / regional fiat stablecoins on Base. */
export const STABLECOIN_SYMBOLS = new Set([
  'USDC',
  'DAI',
  'EURC',
  'XSGD',
  'AUDD',
  'BRZ',
  'MXNE',
]);

/** Cash-like holdings: stables including DAI. */
export const PORTFOLIO_CASH_SYMBOLS = STABLECOIN_SYMBOLS;

export type PortfolioDisplayGroup = 'cash' | 'crypto' | 'earn' | 'stocks';

const SMALL_BALANCE_USD = 1;

export function isStablecoinSymbol(symbol: string): boolean {
  return STABLECOIN_SYMBOLS.has(symbol.toUpperCase());
}

/** i18n key under `crypto.*` for the fiat peg label shown in stablecoin notes. */
export function stablecoinPegKey(symbol: string): string {
  switch (symbol.toUpperCase()) {
    case 'USDC':
    case 'DAI':
      return 'stablecoinPegUsd';
    case 'EURC':
      return 'stablecoinPegEur';
    case 'XSGD':
      return 'stablecoinPegSgd';
    case 'AUDD':
      return 'stablecoinPegAud';
    case 'BRZ':
      return 'stablecoinPegBrl';
    case 'MXNE':
      return 'stablecoinPegMxn';
    default:
      return 'stablecoinPegFiat';
  }
}

export function isCryptoSymbol(symbol: string): boolean {
  return !STABLECOIN_SYMBOLS.has(symbol.toUpperCase());
}

export function getPortfolioDisplayGroup(symbol: string): 'cash' | 'crypto' {
  if (isStablecoinSymbol(symbol)) return 'cash';
  return 'crypto';
}

export function shouldShowPortfolioToken(
  item: PortfolioToken,
  _group: 'cash' | 'crypto',
  hideSmallBalances: boolean,
): boolean {
  if (item.holdings <= 0 || item.value <= 0) return false;
  return !hideSmallBalances || item.value >= SMALL_BALANCE_USD;
}

export function shouldShowEarnVault(
  depositedUsd: number,
  hideSmallBalances: boolean,
): boolean {
  if (depositedUsd <= 0) return false;
  return !hideSmallBalances || depositedUsd >= SMALL_BALANCE_USD;
}

export function shouldShowPortfolioStock(
  item: StockItem,
  hideSmallBalances: boolean,
): boolean {
  if (item.holdings <= 0 || item.value <= 0) return false;
  return !hideSmallBalances || item.value >= SMALL_BALANCE_USD;
}

export function groupPortfolioTokens(
  tokens: PortfolioToken[],
): Record<'cash' | 'crypto', PortfolioToken[]> {
  const groups: Record<'cash' | 'crypto', PortfolioToken[]> = {
    cash: [],
    crypto: [],
  };

  for (const item of tokens) {
    if (item.token.trackBalance === false) continue;
    groups[getPortfolioDisplayGroup(item.token.symbol)].push(item);
  }

  return groups;
}

export function groupPortfolioStocks(stocks: StockItem[]): StockItem[] {
  return stocks;
}

export function sumEarnDeposits(
  vaults: MorphoVault[],
  positionsByVault: Record<string, MorphoVaultPosition>,
): number {
  return vaults.reduce((sum, v) => {
    return sum + (positionsByVault[v.address.toLowerCase()]?.assetsUsd ?? 0);
  }, 0);
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
