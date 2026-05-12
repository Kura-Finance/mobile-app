import type { AssetSnapshot } from '../../../../shared/store/useFinanceStore';
import { daysForTimeRange, type TimeRangeType } from '../../../../shared/store/finance/types';

/**
 * Broker / Investment page scope: Plaid brokerage + CEX spot.
 * Matches `calculateTotalAssets()` in the history slice.
 */
export function investmentTotalFromSnapshot(snap: AssetSnapshot): number {
  return snap.plaidInvestment + snap.cryptoSpot;
}

export function snapshotsInTimeRange(
  assetHistory: AssetSnapshot[],
  daysInRange: number,
): AssetSnapshot[] {
  const cutoffTime = Date.now() - daysInRange * 24 * 3600 * 1000;
  return assetHistory.filter((snap) => snap.timestamp >= cutoffTime);
}

export function earliestSnapshot(snapshots: AssetSnapshot[]): AssetSnapshot | null {
  if (snapshots.length === 0) return null;
  return snapshots.reduce((earliest, snap) =>
    snap.timestamp < earliest.timestamp ? snap : earliest,
  snapshots[0]);
}

export interface InvestmentPerformanceMetrics {
  currentTotal: number;
  previousTotal: number;
  change: number;
  changePercent: number;
  isPositive: boolean;
  daysInRange: number;
  /** False when there is no history point inside the selected window. */
  hasBaseline: boolean;
}

export function calculateInvestmentPerformance(
  daysInRange: number,
  assetHistory: AssetSnapshot[],
  calculateTotalAssets: () => number,
): InvestmentPerformanceMetrics {
  const currentTotal = calculateTotalAssets();
  const baseline = earliestSnapshot(snapshotsInTimeRange(assetHistory, daysInRange));

  if (!baseline) {
    return {
      currentTotal,
      previousTotal: 0,
      change: 0,
      changePercent: 0,
      isPositive: true,
      daysInRange,
      hasBaseline: false,
    };
  }

  const previousTotal = investmentTotalFromSnapshot(baseline);
  const change = currentTotal - previousTotal;
  const changePercent = previousTotal > 0 ? (change / previousTotal) * 100 : 0;

  return {
    currentTotal,
    previousTotal,
    change,
    changePercent,
    isPositive: change >= 0,
    daysInRange,
    hasBaseline: true,
  };
}

export function calculateInvestmentPerformanceForRange(
  timeRange: TimeRangeType,
  historyDaysLimit: number,
  assetHistory: AssetSnapshot[],
  calculateTotalAssets: () => number,
): InvestmentPerformanceMetrics {
  const effectiveDays = Math.min(daysForTimeRange(timeRange), historyDaysLimit);
  return calculateInvestmentPerformance(effectiveDays, assetHistory, calculateTotalAssets);
}
