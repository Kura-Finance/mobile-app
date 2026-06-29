/**
 * Shared Dinari stocks catalog — single source for Invest + Portfolio tabs.
 */

import { create } from 'zustand';

import type { StockItem } from '../types';
import { fetchStocksCatalogSafe, StocksCatalogLoadError } from './fetchStocksCatalog';

interface LoadOptions {
  includePortfolio: boolean;
  force?: boolean;
}

interface StocksStoreState {
  stocks: StockItem[];
  totalValue: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  hasLoaded: boolean;
  portfolioMerged: boolean;
  load: (options: LoadOptions) => Promise<void>;
  reset: () => void;
}

let loadInFlight: Promise<void> | null = null;

const INITIAL_STATE = {
  stocks: [] as StockItem[],
  totalValue: 0,
  loading: false,
  refreshing: false,
  error: null as string | null,
  hasLoaded: false,
  portfolioMerged: false,
};

export const useStocksStore = create<StocksStoreState>((set, get) => ({
  ...INITIAL_STATE,

  load: async ({ includePortfolio, force = false }) => {
    if (!force && get().hasLoaded && (!includePortfolio || get().portfolioMerged)) {
      return;
    }

    if (loadInFlight) {
      await loadInFlight;
      if (!force && get().hasLoaded && (!includePortfolio || get().portfolioMerged)) {
        return;
      }
    }

    const isRefresh = get().hasLoaded;
    if (isRefresh) {
      set({ refreshing: true });
    } else {
      set({ loading: true });
    }
    set({ error: null });

    loadInFlight = (async () => {
      try {
        const { stocks, totalValue } = await fetchStocksCatalogSafe(includePortfolio);
        set({
          stocks,
          totalValue,
          hasLoaded: true,
          portfolioMerged: includePortfolio || get().portfolioMerged,
          error: null,
        });
      } catch (e: unknown) {
        if (e instanceof StocksCatalogLoadError && e.silent) {
          return;
        }
        set({
          error: e instanceof Error ? e.message : 'Failed to load stocks.',
        });
      } finally {
        set({ loading: false, refreshing: false });
      }
    })();

    try {
      await loadInFlight;
    } finally {
      loadInFlight = null;
    }
  },

  reset: () => {
    set({ ...INITIAL_STATE });
  },
}));

export function resetStocksStore(): void {
  loadInFlight = null;
  useStocksStore.getState().reset();
}
