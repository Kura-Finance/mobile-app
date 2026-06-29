/**
 * Unified TrackFi data entry — finance, hub balances, and DeFi portfolio.
 */
import { useTrackFiFinanceData } from './useTrackFiFinanceData';
import { useTrackFiHubBalances } from './useTrackFiHubBalances';
import { useDefiPortfolio } from './useDefiPortfolio';

export function useTrackFiData(enabled: boolean, unlockSeq = 0) {
  const finance = useTrackFiFinanceData();
  const hub = useTrackFiHubBalances(enabled, unlockSeq);
  const defi = useDefiPortfolio();

  return {
    finance,
    hub,
    defi,
  };
}
