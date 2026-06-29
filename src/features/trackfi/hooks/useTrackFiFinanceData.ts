/**
 * Shared finance + exchange store slices for TrackFi screens.
 * Keeps store subscriptions in one place for dashboard, hub, and DeFi views.
 */
import { useFinanceStore } from '../../../shared/store/finance';
import { useExchangeStore } from '../../../shared/store/useExchangeStore';

export function useTrackFiFinanceData() {
  const accounts = useFinanceStore((s) => s.accounts);
  const transactions = useFinanceStore((s) => s.transactions);
  const assetHistory = useFinanceStore((s) => s.assetHistory);
  const lastRecordedTime = useFinanceStore((s) => s.lastRecordedTime);
  const isLoadingAssetHistory = useFinanceStore((s) => s.isLoadingAssetHistory);
  const isLoadingPlaidData = useFinanceStore((s) => s.isLoadingPlaidData);
  const investmentAccounts = useFinanceStore((s) => s.investmentAccounts);
  const investments = useFinanceStore((s) => s.investments);
  const calculateTotalAssets = useFinanceStore((s) => s.calculateTotalAssets);

  const exchangeAccounts = useExchangeStore((s) => s.exchangeAccounts);
  const exchangeInvestments = useExchangeStore((s) => s.exchangeInvestments);
  const exchangeIsLoading = useExchangeStore((s) => s.isLoading);

  return {
    accounts,
    transactions,
    assetHistory,
    lastRecordedTime,
    isLoadingAssetHistory,
    isLoadingPlaidData,
    investmentAccounts,
    investments,
    calculateTotalAssets,
    exchangeAccounts,
    exchangeInvestments,
    exchangeIsLoading,
  };
}
