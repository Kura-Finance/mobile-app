import type { PortfolioToken } from '../hooks/usePortfolio';
import type { StockItem } from '../../stocks/hooks/useDinari';

export interface PortfolioPnL {
  todayChangeUsd: number;
  todayChangePct: number;
}

/** Estimated daily P&L from 24h price moves on current holdings. */
export function computePortfolioPnL(
  tokens: PortfolioToken[],
  stocks: StockItem[] = [],
): PortfolioPnL {
  let total = 0;
  let todayChangeUsd = 0;

  for (const item of tokens) {
    if (item.holdings <= 0 || item.value <= 0) continue;
    total += item.value;
    todayChangeUsd += item.value * (item.change24h / 100);
  }

  for (const item of stocks) {
    if (item.holdings <= 0 || item.value <= 0) continue;
    total += item.value;
    if (item.change24h != null && Number.isFinite(item.change24h)) {
      todayChangeUsd += item.value * (item.change24h / 100);
    }
  }

  const todayChangePct = total > 0 ? (todayChangeUsd / total) * 100 : 0;
  return { todayChangeUsd, todayChangePct };
}

export function formatSignedPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}
