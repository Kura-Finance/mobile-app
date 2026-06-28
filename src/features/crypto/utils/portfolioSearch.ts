import type { PortfolioToken } from '../hooks/usePortfolio';
import type { StockItem } from '../../stocks/hooks/useDinari';
import type { MorphoVault } from '../../../lib/api/morpho/client';
import type { MorphoMarket } from '../../../lib/api/morpho/markets';

export function normalizeSearchQuery(q: string): string {
  return q.trim().toLowerCase();
}

export function matchesToken(item: PortfolioToken, query: string): boolean {
  const { token } = item;
  return (
    token.symbol.toLowerCase().includes(query) ||
    token.displayName.toLowerCase().includes(query)
  );
}

export function matchesStock(item: StockItem, query: string): boolean {
  return (
    item.symbol.toLowerCase().includes(query) ||
    item.name.toLowerCase().includes(query)
  );
}

export function matchesVault(item: MorphoVault, query: string): boolean {
  return (
    item.name.toLowerCase().includes(query) ||
    item.symbol.toLowerCase().includes(query) ||
    item.asset.symbol.toLowerCase().includes(query)
  );
}

export function matchesMarket(item: MorphoMarket, query: string): boolean {
  return (
    item.loanAsset.symbol.toLowerCase().includes(query) ||
    item.collateralAsset.symbol.toLowerCase().includes(query) ||
    `${item.collateralAsset.symbol}/${item.loanAsset.symbol}`.toLowerCase().includes(query)
  );
}
