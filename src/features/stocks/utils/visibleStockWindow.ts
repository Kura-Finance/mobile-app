import { INVEST_LIST_ROW_HEIGHT } from '../../crypto/components/invest/investListMetrics';
import type { StockItem } from '../hooks/useDinari';

/** Default page size — roughly one screen of stock rows before "Load more". */
export const STOCK_LIST_PAGE_SIZE = 20;

/** Stocks whose rows overlap the current list scroll viewport (+ buffer). */
export function stocksInScrollViewport(
  stocks: StockItem[],
  scrollY: number,
  viewportHeight: number,
): StockItem[] {
  if (stocks.length === 0 || viewportHeight <= 0) return stocks;

  const start = Math.max(0, Math.floor(scrollY / INVEST_LIST_ROW_HEIGHT) - 1);
  const count = Math.ceil(viewportHeight / INVEST_LIST_ROW_HEIGHT) + 2;
  return stocks.slice(start, Math.min(stocks.length, start + count));
}
