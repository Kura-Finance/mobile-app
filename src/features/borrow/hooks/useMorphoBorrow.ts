import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchMorphoMarkets,
  fetchUserBorrowPositions,
  type MorphoBorrowPosition,
  type MorphoMarket,
} from '../../../lib/api/morpho/markets';

interface State {
  markets: MorphoMarket[];
  positions: MorphoBorrowPosition[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
}

export function useMorphoBorrow(userAddress: string | null, enabled = true) {
  const [state, setState] = useState<State>({
    markets: [],
    positions: [],
    loading: false,
    refreshing: false,
    error: null,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (!enabled) return;

    setState((prev) => ({
      ...prev,
      loading: !isRefresh && prev.markets.length === 0,
      refreshing: isRefresh,
      error: null,
    }));

    try {
      const positions = userAddress
        ? await fetchUserBorrowPositions(userAddress)
        : [];
      const positionMarketIds = positions.map((p) => p.marketId);
      const markets = await fetchMorphoMarkets({ includeMarketIds: positionMarketIds });

      if (!mountedRef.current) return;
      setState({
        markets,
        positions,
        loading: false,
        refreshing: false,
        error: null,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : 'Failed to load borrow markets',
      }));
    }
  }, [enabled, userAddress]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  const totalBorrowedUsd = state.positions.reduce(
    (sum, item) => sum + item.borrowAssetsUsd,
    0,
  );

  const positionsByMarket = useMemo(
    () =>
      state.positions.reduce<Record<string, MorphoBorrowPosition>>((acc, item) => {
        acc[item.marketId.toLowerCase()] = item;
        return acc;
      }, {}),
    [state.positions],
  );

  return {
    ...state,
    totalBorrowedUsd,
    positionsByMarket,
    refresh,
  };
}
