/**
 * Aggregated data for the TrackFi unified dashboard.
 */
import { useMemo } from 'react';
import { useTheme } from '../../../shared/theme/ThemeContext';
import { useTrackFiData } from './useTrackFiData';
import type { Account, Transaction } from '../../../shared/store/finance/types';
import { walletDataKey, walletPortfolioTotal } from './useDefiPortfolio';
import { snapshotsInTimeRange } from '../investment/utils/investmentPerformance';
import { FULL_ASSET_HISTORY_DAYS, isBasicMembership } from '../../../shared/utils/membership';
import {
  bankingAssetAllocation,
  creditLiabilityAmount,
  netBankingBalance,
  sumCreditLiabilities,
  sumDepositoryBalances,
} from '../utils/bankingBalances';

export type TrackFiChartRange = '1D' | '1W' | '1M' | 'YTD';

const PRO_CHART_RANGES: TrackFiChartRange[] = ['1D', '1W', '1M', 'YTD'];
const BASIC_CHART_RANGES: TrackFiChartRange[] = ['1D', '1W'];

export function getTrackFiChartRanges(membershipLabel: string): TrackFiChartRange[] {
  return isBasicMembership(membershipLabel) ? BASIC_CHART_RANGES : PRO_CHART_RANGES;
}

export const TRACKFI_CHART_RANGE_LABEL_KEYS: Record<TrackFiChartRange, string> = {
  '1D': 'trackfi.dashboard.chartRange1D',
  '1W': 'trackfi.dashboard.chartRange1W',
  '1M': 'trackfi.dashboard.chartRange1M',
  YTD: 'trackfi.dashboard.chartRangeYTD',
};

function daysSinceYearStart(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  return Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (24 * 3600 * 1000)));
}

export function daysForTrackFiChartRange(range: TrackFiChartRange): number {
  switch (range) {
    case '1D':
      return 1;
    case '1W':
      return 7;
    case '1M':
      return 30;
    case 'YTD':
      return daysSinceYearStart();
  }
}

export function effectiveDaysForTrackFiChartRange(
  range: TrackFiChartRange,
  historyDaysLimit: number,
): number {
  return Math.min(daysForTrackFiChartRange(range), historyDaysLimit);
}

export interface AccountLineItem {
  label?: string;
  labelKey?: string;
  amount: number;
}

export interface AccountCategory {
  id: 'banking' | 'brokers' | 'defi';
  total: number;
  count: number;
  countLabelKey: 'trackfi.dashboard.accountCount' | 'trackfi.dashboard.walletCount';
  lines: AccountLineItem[];
  accent: string;
  icon: string;
  navigateTo: 'banking' | 'brokers' | 'debank';
}

export interface AllocationSegment {
  id: AccountCategory['id'];
  labelKey: string;
  value: number;
  color: string;
}

function topAccountLines(accounts: Account[], limit = 2): AccountLineItem[] {
  return [...accounts]
    .sort((a, b) => b.balance - a.balance)
    .slice(0, limit)
    .map((a) => ({
      label: a.mask ? `${a.name} •••• ${a.mask}` : a.name,
      amount: a.balance,
    }));
}

export function useTrackFiDashboardData(
  enabled: boolean,
  chartRange: TrackFiChartRange,
  historyDaysLimit: number = FULL_ASSET_HISTORY_DAYS,
) {
  const { colors } = useTheme();
  const { finance, hub, defi } = useTrackFiData(enabled);
  const {
    accounts,
    transactions,
    assetHistory,
    lastRecordedTime,
    isLoadingAssetHistory,
    investmentAccounts,
    investments,
    exchangeAccounts,
    exchangeInvestments,
  } = finance;
  const { watched, walletData } = defi;

  const checkingAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'checking'),
    [accounts],
  );
  const savingsAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'saving'),
    [accounts],
  );
  const creditAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'credit'),
    [accounts],
  );

  const bankDeposits = useMemo(() => sumDepositoryBalances(accounts), [accounts]);
  const creditTotal = useMemo(() => sumCreditLiabilities(accounts), [accounts]);
  const brokersTotal = hub.brokers.total;
  const defiTotal = hub.defi.total;

  const netWorth = useMemo(
    () => bankDeposits - creditTotal + brokersTotal + defiTotal,
    [bankDeposits, creditTotal, brokersTotal, defiTotal],
  );

  const boundedAssetHistory = useMemo(
    () => snapshotsInTimeRange(assetHistory, historyDaysLimit),
    [assetHistory, historyDaysLimit],
  );

  const chartSnapshots = useMemo(() => {
    const days = effectiveDaysForTrackFiChartRange(chartRange, historyDaysLimit);
    return snapshotsInTimeRange(boundedAssetHistory, days);
  }, [boundedAssetHistory, chartRange, historyDaysLimit]);

  const chartPrices = useMemo(() => {
    if (chartSnapshots.length >= 2) {
      return chartSnapshots.map((s) => s.totalAssets);
    }
    if (chartSnapshots.length === 1) {
      return [chartSnapshots[0].totalAssets, netWorth];
    }
    return netWorth > 0 ? [netWorth, netWorth] : [];
  }, [chartSnapshots, netWorth]);

  const dayChange = useMemo(() => {
    const sorted = [...boundedAssetHistory].sort((a, b) => a.timestamp - b.timestamp);
    const prev =
      sorted.length >= 2 ? sorted[sorted.length - 2].totalAssets : sorted[0]?.totalAssets ?? netWorth;
    const change = netWorth - prev;
    const pct = prev !== 0 ? (change / Math.abs(prev)) * 100 : 0;
    return { change, pct, hasBaseline: sorted.length >= 1 };
  }, [boundedAssetHistory, netWorth]);

  const bankLines = useMemo((): AccountLineItem[] => {
    const lines: AccountLineItem[] = [];
    const checkingTotal = accounts
      .filter((a) => a.type === 'checking')
      .reduce((sum, a) => sum + a.balance, 0);
    const savingsTotal = accounts
      .filter((a) => a.type === 'saving')
      .reduce((sum, a) => sum + a.balance, 0);
    if (checkingTotal > 0) {
      lines.push({ labelKey: 'trackfi.dashboard.checking', amount: checkingTotal });
    }
    if (savingsTotal > 0) {
      lines.push({ labelKey: 'trackfi.dashboard.savings', amount: savingsTotal });
    }
    if (lines.length === 0 && checkingAccounts.length + savingsAccounts.length > 0) {
      return topAccountLines([...checkingAccounts, ...savingsAccounts]);
    }
    return lines.slice(0, 2);
  }, [accounts, checkingAccounts.length, savingsAccounts.length]);

  const creditLines = useMemo(
    () => topAccountLines(creditAccounts),
    [creditAccounts],
  );

  const brokerLines = useMemo((): AccountLineItem[] => {
    const lines: AccountLineItem[] = [];
    for (const acc of investmentAccounts.filter((a) => a.type === 'Broker').slice(0, 2)) {
      const value = investments
        .filter((i) => i.accountId === acc.id)
        .reduce((s, i) => s + (i.usdValue || i.holdings * i.currentPrice), 0);
      lines.push({ label: acc.name, amount: value });
    }
    for (const acc of exchangeAccounts.slice(0, Math.max(0, 2 - lines.length))) {
      const value = exchangeInvestments
        .filter((i) => i.accountId === acc.id)
        .reduce((s, i) => s + (i.usdValue || i.holdings * i.currentPrice), 0);
      lines.push({ label: acc.exchangeDisplayName, amount: value });
    }
    return lines.slice(0, 2);
  }, [investmentAccounts, exchangeAccounts, exchangeInvestments, investments]);

  const defiLines = useMemo((): AccountLineItem[] => {
    return watched.slice(0, 2).map((w) => {
      const data = walletData[walletDataKey(w.address)];
      const total = data ? walletPortfolioTotal(data) : 0;
      return { label: w.label ?? w.address.slice(0, 6), amount: total };
    });
  }, [watched, walletData]);

  const bankingNet = useMemo(() => netBankingBalance(accounts), [accounts]);
  const bankingAllocation = useMemo(() => bankingAssetAllocation(accounts), [accounts]);

  const bankingLines = useMemo((): AccountLineItem[] => {
    const lines = [...bankLines];
    for (const line of creditLines) {
      lines.push({ ...line, amount: -creditLiabilityAmount(line.amount) });
    }
    return lines.slice(0, 2);
  }, [bankLines, creditLines]);

  const categories = useMemo((): AccountCategory[] => {
    const bankCount = checkingAccounts.length + savingsAccounts.length;
    const bankingCount = bankCount + creditAccounts.length;
    const brokerCount =
      investmentAccounts.filter((a) => a.type !== 'Web3 Wallet').length + exchangeAccounts.length;

    const cats: AccountCategory[] = [
      {
        id: 'banking',
        total: bankingNet,
        count: bankingCount,
        countLabelKey: 'trackfi.dashboard.accountCount',
        lines: bankingLines,
        accent: colors.primary,
        icon: 'wallet-outline',
        navigateTo: 'banking',
      },
      {
        id: 'brokers',
        total: brokersTotal,
        count: brokerCount,
        countLabelKey: 'trackfi.dashboard.accountCount',
        lines: brokerLines,
        accent: colors.success,
        icon: 'bar-chart-outline',
        navigateTo: 'brokers',
      },
      {
        id: 'defi',
        total: defiTotal,
        count: watched.length,
        countLabelKey: 'trackfi.dashboard.walletCount',
        lines: defiLines,
        accent: colors.warning,
        icon: 'git-network-outline',
        navigateTo: 'debank',
      },
    ];
    return cats;
  }, [
    bankingLines,
    bankingNet,
    brokersTotal,
    brokerLines,
    checkingAccounts.length,
    creditAccounts.length,
    defiLines,
    defiTotal,
    exchangeAccounts.length,
    investmentAccounts,
    savingsAccounts.length,
    watched.length,
    colors.primary,
    colors.success,
    colors.warning,
  ]);

  const allocation = useMemo((): AllocationSegment[] => {
    return [
      {
        id: 'banking',
        labelKey: 'trackfi.dashboard.banking',
        value: bankingAllocation,
        color: colors.primary,
      },
      {
        id: 'brokers',
        labelKey: 'trackfi.dashboard.brokers',
        value: Math.max(0, brokersTotal),
        color: colors.success,
      },
      {
        id: 'defi',
        labelKey: 'trackfi.dashboard.defi',
        value: Math.max(0, defiTotal),
        color: colors.warning,
      },
    ];
  }, [bankingAllocation, brokersTotal, defiTotal, colors.primary, colors.success, colors.warning]);

  const allocationDenominator = useMemo(
    () => allocation.reduce((s, seg) => s + seg.value, 0),
    [allocation],
  );

  const recentTransactions = useMemo((): Transaction[] => {
    return [...transactions]
      .sort((a, b) => {
        const da = Date.parse(a.date) || 0;
        const db = Date.parse(b.date) || 0;
        return db - da;
      })
      .slice(0, 4);
  }, [transactions]);

  const lastSyncedMs = lastRecordedTime ?? null;
  const isLoading = hub.banking.isLoading || hub.brokers.isLoading || isLoadingAssetHistory;

  return {
    netWorth,
    dayChange,
    chartPrices,
    chartSnapshots,
    categories,
    allocation,
    allocationDenominator,
    recentTransactions,
    lastSyncedMs,
    isLoading,
    hasAnyData:
      accounts.length > 0 ||
      hub.brokers.hasData ||
      hub.defi.hasData ||
      assetHistory.length > 0,
    refreshDefi: defi.refresh,
  };
}
