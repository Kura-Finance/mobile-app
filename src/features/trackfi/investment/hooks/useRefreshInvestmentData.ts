import { useState, useCallback } from 'react';
import { useFinanceStore } from '../../../../shared/store/finance';
import { useExchangeStore } from '../../../../shared/store/useExchangeStore';
import { getUsableAuthToken } from '../../../../lib/security/sessionAccess';
import Logger from '../../../../shared/utils/Logger';

/**
 * Hook for managing Investment data refresh with pull-to-refresh UI state
 * Responsibility: Refresh both Plaid finance data AND exchange balances
 */
export function useRefreshInvestmentData() {
  const [refreshing, setRefreshing] = useState(false);
  const hydratePlaidFinanceData = useFinanceStore((state) => state.hydratePlaidFinanceData);
  const hydrateAssetHistory = useFinanceStore((state) => state.hydrateAssetHistory);
  const fetchExchangeBalances = useExchangeStore((state) => state.fetchExchangeBalances);
  const exchangeAccounts = useExchangeStore((state) => state.exchangeAccounts);

  const handleRefresh = useCallback(async () => {
    const authToken = getUsableAuthToken();
    if (!authToken) {
      Logger.warn('useRefreshInvestmentData', 'No auth token available');
      return;
    }

    setRefreshing(true);
    try {
      // Phase 3: encrypted snapshot lazy-refreshes when cache TTL expires (and
      // seeds AssetSnapshot history). Pull-to-refresh re-fetches that path.
      await hydratePlaidFinanceData(authToken, true);

      if (exchangeAccounts.length > 0) {
        const exchangeRefreshPromises = exchangeAccounts.map((account) =>
          fetchExchangeBalances(account.id, authToken, true).catch((error: unknown) => {
            Logger.warn('useRefreshInvestmentData', `Failed to refresh exchange ${account.id}`, {
              error: error instanceof Error ? error.message : String(error),
            });
          }),
        );
        await Promise.all(exchangeRefreshPromises);
      }

      await hydrateAssetHistory(undefined, true);
    } catch (error) {
      Logger.error('useRefreshInvestmentData', 'Failed to refresh investment data', error);
    } finally {
      setRefreshing(false);
    }
  }, [hydratePlaidFinanceData, hydrateAssetHistory, fetchExchangeBalances, exchangeAccounts]);

  return {
    refreshing,
    handleRefresh,
  };
}
