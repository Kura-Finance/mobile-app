import { BLUE_CHIPS } from '../config/blueChips';
import type { PortfolioToken } from '../hooks/usePortfolio';
import type { StockItem } from '../../stocks/hooks/useDinari';
import { featuredStockSortIndex } from '../../stocks/config/dinariStocks';

export type InvestSortKey = 'price' | 'marketCap' | 'gainers' | 'losers';

export const INVEST_SORT_OPTIONS: InvestSortKey[] = [
  'price',
  'marketCap',
  'gainers',
  'losers',
];

/** Stock lists have no market-cap feed — price / 24h change only. */
export const INVEST_STOCK_SORT_OPTIONS: InvestSortKey[] = [
  'price',
  'gainers',
  'losers',
];

function chipIndex(token: PortfolioToken['token']): number {
  const idx = BLUE_CHIPS.indexOf(token);
  return idx >= 0 ? idx : Number.MAX_SAFE_INTEGER;
}

export function sortPortfolioTokens(
  items: PortfolioToken[],
  sortKey: InvestSortKey,
): PortfolioToken[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case 'price':
        cmp = b.price - a.price;
        break;
      case 'marketCap':
        cmp = (b.marketCap ?? 0) - (a.marketCap ?? 0);
        break;
      case 'gainers':
        cmp = b.change24h - a.change24h;
        break;
      case 'losers':
        cmp = a.change24h - b.change24h;
        break;
    }
    if (cmp !== 0) return cmp;
    return chipIndex(a.token) - chipIndex(b.token);
  });
}

function stockTiebreak(a: StockItem, b: StockItem): number {
  const featured = featuredStockSortIndex(a.symbol) - featuredStockSortIndex(b.symbol);
  if (featured !== 0) return featured;
  return a.symbol.localeCompare(b.symbol, undefined, { sensitivity: 'base' });
}

function hasQuoteForSort(item: StockItem, sortKey: InvestSortKey): boolean {
  switch (sortKey) {
    case 'price':
    case 'marketCap':
      return item.price > 0;
    case 'gainers':
    case 'losers':
      return item.change24h != null && Number.isFinite(item.change24h);
    default:
      return false;
  }
}

function compareQuotedStocks(a: StockItem, b: StockItem, sortKey: InvestSortKey): number {
  switch (sortKey) {
    case 'price':
    case 'marketCap':
      return b.price - a.price;
    case 'gainers':
      return (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity);
    case 'losers':
      return (a.change24h ?? Infinity) - (b.change24h ?? Infinity);
    default:
      return 0;
  }
}

export function sortStocks(items: StockItem[], sortKey: InvestSortKey): StockItem[] {
  const quoted: StockItem[] = [];
  const unquoted: StockItem[] = [];
  for (const item of items) {
    (hasQuoteForSort(item, sortKey) ? quoted : unquoted).push(item);
  }

  quoted.sort((a, b) => {
    const cmp = compareQuotedStocks(a, b, sortKey);
    if (cmp !== 0) return cmp;
    return stockTiebreak(a, b);
  });

  unquoted.sort(stockTiebreak);
  return [...quoted, ...unquoted];
}
