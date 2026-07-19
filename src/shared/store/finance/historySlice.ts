/**
 * Asset history slice.
 *
 * Error + cache strategy:
 *   ┌─ Live fetch fails
 *   │
 *   └─ Network / API error
 *         → Fall back to raw cache (stale-data UX)
 *         → Show error state if cache also misses
 */

import { StateCreator } from 'zustand';
import { AssetSnapshot, FinanceState, HistoryState, Investment } from './types';
import { fetchAssetHistory, fetchAssetHistoryFromCache } from '../../../lib/api/asset';
import { getMembershipLabelForHistory } from '../membershipLabelAccess';
import { getAssetHistoryDaysLimit } from '../../utils/membership';
import { useExchangeStore } from '../useExchangeStore';
import Logger from '../../utils/Logger';
import { isStablecoin } from '../../utils/stablecoinUtils';
import {
  markTrackFiSynced,
  shouldAutoSyncTrackFi,
} from '../../../features/trackfi/utils/trackFiSyncPolicy';


function resolveAssetHistoryDays(days?: number): number {
  if (days != null) return days;
  return getAssetHistoryDaysLimit(getMembershipLabelForHistory());
}

function toAssetSnapshot(point: {
  date: string;
  cashFlow: number;
  plaidInvestment: number;
  cryptoSpot: number;
  defiProtocol: number;
  totalAssets: number;
}): AssetSnapshot {
  return {
    date: point.date,
    timestamp: Date.parse(`${point.date}T00:00:00.000Z`),
    cashFlow: point.cashFlow,
    plaidInvestment: point.plaidInvestment,
    cryptoSpot: point.cryptoSpot,
    defiProtocol: point.defiProtocol,
    totalAssets: point.totalAssets,
  };
}

export const createHistorySlice: StateCreator<FinanceState, [], [], HistoryState> = (set, get, _api) => ({
  assetHistory: [],
  lastRecordedTime: null,
  lastFetchedDays: null,
  isLoadingAssetHistory: false,
  assetHistoryError: null,

  calculateTotalAssets: () => {
    const sumInvestments = (list: Investment[]): number =>
      list.reduce((sum, investment) => {
        if (isStablecoin(investment.symbol)) return sum;
        const value = investment.usdValue || investment.holdings * investment.currentPrice;
        return sum + value;
      }, 0);

    const plaidValue = sumInvestments(get().investments);
    // Exchange (CEX) spot balances live in their own store; include them so the
    // Total Assets figure matches the holdings shown on the Broker page.
    const exchangeValue = sumInvestments(useExchangeStore.getState().exchangeInvestments);

    return plaidValue + exchangeValue;
  },

  hydrateAssetHistory: async (days?: number, force: boolean = false) => {
    if (!shouldAutoSyncTrackFi('assetHistory', { force })) {
      Logger.debug('HistorySlice', 'Skipping asset history hydrate — synced within the last hour');
      return;
    }

    const fetchDays = resolveAssetHistoryDays(days);

    set({ isLoadingAssetHistory: true, assetHistoryError: null });
    try {
      const points = await fetchAssetHistory(fetchDays);
      set({
        assetHistory: points.map(toAssetSnapshot),
        lastRecordedTime: Date.now(),
        lastFetchedDays: fetchDays,
        isLoadingAssetHistory: false,
      });
      markTrackFiSynced('assetHistory');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch asset history';

      // Network / API error — try stale cache
      try {
        const points = await fetchAssetHistoryFromCache();
        if (points) {
          set({ assetHistory: points.map(toAssetSnapshot), isLoadingAssetHistory: false });
          Logger.warn('HistorySlice', 'Network error; serving asset history from local cache', {
            message,
            points: points.length,
          });
          return;
        }
      } catch {
        // cache miss
      }

      Logger.warn('HistorySlice', 'Asset history hydration failed', { message });
      set({ isLoadingAssetHistory: false, assetHistoryError: message });
    }
  },

  clearAssetHistory: () => {
    set({
      assetHistory: [],
      lastRecordedTime: null,
      lastFetchedDays: null,
      assetHistoryError: null,
    });
  },
});
