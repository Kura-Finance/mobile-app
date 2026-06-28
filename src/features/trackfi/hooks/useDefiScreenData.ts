/**
 * Aggregates watched-wallet DeBank data for the DeFi sub-screen UI.
 */
import { useMemo, useState } from 'react';
import { useFinanceStore } from '../../../shared/store/useFinanceStore';
import { useTheme } from '../../../shared/theme/ThemeContext';
import {
  effectiveProtocolDisplayUsd,
} from '../../../lib/api/debank/portfolioTotals';
import { computeDefiAllocationBuckets } from '../utils/defiAllocation';
import {
  useDefiPortfolio,
  walletDataKey,
  walletPortfolioTotal,
  type DefiProtocol,
  type DefiToken,
  type WalletData,
} from './useDefiPortfolio';
import { snapshotsInTimeRange } from '../investment/utils/investmentPerformance';
import type { AssetSnapshot } from '../../../shared/store/useFinanceStore';

export type DefiChartRange = '1W' | '1M' | '3M' | '1Y' | 'ALL';

export const DEFI_CHART_RANGES: DefiChartRange[] = ['1W', '1M', '3M', '1Y', 'ALL'];

export const DEFI_CHART_RANGE_LABEL_KEYS: Record<DefiChartRange, string> = {
  '1W': 'trackfi.defi.range1W',
  '1M': 'trackfi.defi.range1M',
  '3M': 'trackfi.defi.range3M',
  '1Y': 'trackfi.defi.range1Y',
  ALL: 'trackfi.defi.rangeAll',
};

function daysForDefiRange(range: DefiChartRange): number {
  switch (range) {
    case '1W': return 7;
    case '1M': return 30;
    case '3M': return 90;
    case '1Y': return 365;
    case 'ALL': return 3650;
  }
}

function defiTotalFromSnapshot(snap: AssetSnapshot): number {
  return snap.defiProtocol ?? 0;
}

function mergeTokens(wallets: WalletData[]): DefiToken[] {
  const map = new Map<string, DefiToken>();
  for (const w of wallets) {
    for (const t of w.tokens) {
      const key = `${t.chain}-${t.id}`;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { ...t });
      } else {
        map.set(key, {
          ...prev,
          amount: prev.amount + t.amount,
          usdValue: prev.usdValue + t.usdValue,
        });
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.usdValue - a.usdValue);
}

function mergeProtocols(wallets: WalletData[]): DefiProtocol[] {
  const map = new Map<string, DefiProtocol>();
  for (const w of wallets) {
    for (const p of w.protocols) {
      const key = `${p.chain}-${p.id}`;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, { ...p, portfolioItems: [...p.portfolioItems] });
      } else {
        map.set(key, {
          ...prev,
          netUsdValue: prev.netUsdValue + p.netUsdValue,
          assetUsdValue: prev.assetUsdValue + p.assetUsdValue,
          debtUsdValue: prev.debtUsdValue + p.debtUsdValue,
          portfolioItems: [...prev.portfolioItems, ...p.portfolioItems],
        });
      }
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => effectiveProtocolDisplayUsd(b) - effectiveProtocolDisplayUsd(a),
  );
}

function sumRewards(protocols: DefiProtocol[]): number {
  let total = 0;
  for (const p of protocols) {
    for (const item of p.portfolioItems) {
      if (item.type.toLowerCase().includes('reward')) {
        total += item.usdValue;
      }
    }
  }
  return total;
}

function estimateApy(protocols: DefiProtocol[], totalYield: number): number | null {
  const supplied = protocols.reduce((sum, p) => {
    const lend = p.portfolioItems
      .filter((i) => /supply|lend|stake|deposit/i.test(i.type))
      .reduce((s, i) => s + i.usdValue, 0);
    return sum + (lend > 0 ? lend : effectiveProtocolDisplayUsd(p));
  }, 0);
  if (supplied <= 0 || totalYield <= 0) return null;
  return (totalYield / supplied) * 100;
}

export interface DefiAllocationBucket {
  id: 'stablecoins' | 'crypto' | 'yield' | 'other';
  labelKey: string;
  value: number;
  color: string;
}

export function useDefiScreenData() {
  const portfolio = useDefiPortfolio();
  const { colors } = useTheme();
  const assetHistory = useFinanceStore((s) => s.assetHistory);
  const isLoadingHistory = useFinanceStore((s) => s.isLoadingAssetHistory);
  const [chartRange, setChartRange] = useState<DefiChartRange>('1W');

  const walletRows = useMemo(
    () => portfolio.watched.map((w) => {
      const existing = portfolio.walletData[walletDataKey(w.address)];
      if (existing) return existing;
      return {
        address: w.address,
        label: w.label,
        tokenTotalUsdValue: 0,
        protocolTotalUsdValue: 0,
        tokens: [],
        protocols: [],
        isLoading: true,
        error: null,
      } satisfies WalletData;
    }),
    [portfolio.watched, portfolio.walletData],
  );

  const tokens = useMemo(() => mergeTokens(walletRows), [walletRows]);
  const protocols = useMemo(() => mergeProtocols(walletRows), [walletRows]);

  const allocation = useMemo((): DefiAllocationBucket[] => {
    const buckets = computeDefiAllocationBuckets(walletRows, portfolio.totalUsdValue);
    return [
      { id: 'stablecoins', labelKey: 'trackfi.defi.allocStablecoins', value: buckets.stablecoins, color: colors.primary },
      { id: 'crypto', labelKey: 'trackfi.defi.allocEthLst', value: buckets.crypto, color: '#60A5FA' },
      { id: 'yield', labelKey: 'trackfi.defi.allocYield', value: buckets.yield, color: colors.success },
      { id: 'other', labelKey: 'trackfi.defi.allocOther', value: buckets.other, color: '#F59E0B' },
    ];
  }, [walletRows, portfolio.totalUsdValue, colors.primary, colors.success]);

  const allocationTotal = useMemo(
    () => (portfolio.totalUsdValue > 0 ? portfolio.totalUsdValue : allocation.reduce((s, b) => s + b.value, 0)),
    [allocation, portfolio.totalUsdValue],
  );

  const chartDays = daysForDefiRange(chartRange);
  const chartSnapshots = useMemo(
    () => snapshotsInTimeRange(assetHistory, chartDays),
    [assetHistory, chartDays],
  );

  const chartPrices = useMemo(() => {
    const fromHistory = chartSnapshots.map(defiTotalFromSnapshot);
    if (fromHistory.length >= 2) return fromHistory;
    if (portfolio.totalUsdValue > 0) {
      return [portfolio.totalUsdValue, portfolio.totalUsdValue];
    }
    return [];
  }, [chartSnapshots, portfolio.totalUsdValue]);

  const changeMetrics = useMemo(() => {
    const current = portfolio.totalUsdValue;
    if (chartSnapshots.length >= 2) {
      const first = defiTotalFromSnapshot(chartSnapshots[0]);
      const change = current - first;
      const changePercent = first > 0 ? (change / first) * 100 : 0;
      return {
        change,
        changePercent,
        isPositive: change >= 0,
        hasBaseline: true,
      };
    }
    return { change: 0, changePercent: 0, isPositive: true, hasBaseline: false };
  }, [chartSnapshots, portfolio.totalUsdValue]);

  const totalYieldEarned = useMemo(() => sumRewards(protocols), [protocols]);
  const estApy = useMemo(
    () => estimateApy(protocols, totalYieldEarned),
    [protocols, totalYieldEarned],
  );

  const anyLoading = portfolio.isInitialising
    || walletRows.some((w) => w.isLoading)
    || (portfolio.watched.length > 0 && portfolio.totalUsdValue === 0 && walletRows.some((w) => w.isLoading));

  return {
    ...portfolio,
    chartRange,
    setChartRange,
    tokens,
    protocols,
    allocation,
    allocationTotal,
    chartPrices,
    changeMetrics,
    totalYieldEarned,
    estApy,
    walletRows,
    isLoadingHistory,
    anyLoading,
  };
}
