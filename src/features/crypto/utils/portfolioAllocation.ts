import type { PortfolioDisplayGroup } from '../config/portfolioAssetClasses';

export interface AllocationSlice {
  key: PortfolioDisplayGroup;
  labelKey: string;
  color: string;
  value: number;
  pct: number;
}

export const ALLOCATION_COLORS: Record<PortfolioDisplayGroup, string> = {
  cash: '#8B5CF6',
  crypto: '#10B981',
  earn: '#3B82F6',
  stocks: '#F97316',
};

export const ALLOCATION_LABEL_KEYS: Record<PortfolioDisplayGroup, string> = {
  cash: 'crypto.portfolioGroupCash',
  crypto: 'crypto.portfolioGroupCrypto',
  earn: 'crypto.portfolioGroupEarn',
  stocks: 'crypto.portfolioGroupStocks',
};

/** Display order: Cash → Earn → Stock → Crypto. */
const SLICE_RANK: Record<PortfolioDisplayGroup, number> = {
  cash: 0,
  earn: 1,
  stocks: 2,
  crypto: 3,
};

const ALL_SLICE_KEYS: PortfolioDisplayGroup[] = ['cash', 'earn', 'stocks', 'crypto'];

export function computePortfolioAllocation(
  totals: Record<PortfolioDisplayGroup, number>,
  portfolioTotal: number,
  options?: { includeStocks?: boolean },
): AllocationSlice[] {
  const includeStocks = options?.includeStocks ?? true;
  const keys = includeStocks ? ALL_SLICE_KEYS : ALL_SLICE_KEYS.filter((k) => k !== 'stocks');

  const slices = keys.map((key) => {
    const value = totals[key] ?? 0;
    const pct = portfolioTotal > 0 ? (value / portfolioTotal) * 100 : 0;
    return {
      key,
      labelKey: ALLOCATION_LABEL_KEYS[key],
      color: ALLOCATION_COLORS[key],
      value,
      pct,
    };
  });

  return slices.sort((a, b) => SLICE_RANK[a.key] - SLICE_RANK[b.key]);
}
