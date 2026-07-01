/**
 * Unified TrackFi data entry — finance, hub balances, and DeFi portfolio.
 */
import { useEffect } from 'react';
import { features } from '../../../config/features';
import { useTrackFiFinanceData } from './useTrackFiFinanceData';
import { useTrackFiHubBalances } from './useTrackFiHubBalances';
import { useDefiPortfolio } from './useDefiPortfolio';

export function useTrackFiData(enabled: boolean) {
  const finance = useTrackFiFinanceData();
  const defi = useDefiPortfolio();
  const hub = useTrackFiHubBalances(enabled, finance, defi);

  useEffect(() => {
    if (!enabled || !features.debank || defi.isInitialising) return;
    void defi.loadCached();
  }, [enabled, defi.isInitialising, defi.loadCached]);

  return {
    finance,
    hub,
    defi,
  };
}
