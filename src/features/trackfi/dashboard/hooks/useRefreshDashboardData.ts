import { useState, useCallback } from 'react';
import { useFinanceStore } from '../../../../shared/store/finance';
import { useExchangeStore } from '../../../../shared/store/useExchangeStore';
import { getUsableAuthToken } from '../../../../lib/security/sessionAccess';
import Logger from '../../../../shared/utils/Logger';

/**
 * Hook for managing Dashboard data refresh with pull-to-refresh UI state
 * Responsibility: Refresh Plaid finance data (accounts & transactions) and Exchange cryptocurrencies
 */
export function useRefreshDashboardData() {
  const [refreshing, setRefreshing] = useState(false);
  const hydratePlaidFinanceData = useFinanceStore((state) => state.hydratePlaidFinanceData);
  const exchangeAccounts = useExchangeStore((state) => state.exchangeAccounts);
  const fetchExchangeBalances = useExchangeStore((state) => state.fetchExchangeBalances);

  const handleRefresh = useCallback(async () => {
    const authToken = getUsableAuthToken();
    if (!authToken) {
      Logger.warn('useRefreshDashboardData', 'No auth token available');
      return;
    }

    setRefreshing(true);
    try {
      Logger.debug('useRefreshDashboardData', 'Refreshing Plaid data and exchange accounts');

      await hydratePlaidFinanceData(authToken, true);
      Logger.info('useRefreshDashboardData', 'Plaid data refreshed successfully');

      if (exchangeAccounts.length > 0) {
        const exchangeRefreshPromises = exchangeAccounts.map((account) =>
          fetchExchangeBalances(account.id, authToken, true).catch((error) => {
            Logger.error('useRefreshDashboardData', `Failed to refresh exchange ${account.exchange}`, {
              accountId: account.id,
              error,
            });
          }),
        );
        await Promise.all(exchangeRefreshPromises);
        Logger.info('useRefreshDashboardData', 'Exchange accounts refreshed successfully', {
          count: exchangeAccounts.length,
        });
      }
    } catch (error) {
      Logger.error('useRefreshDashboardData', 'Failed to refresh data', error);
    } finally {
      setRefreshing(false);
    }
  }, [hydratePlaidFinanceData, exchangeAccounts, fetchExchangeBalances]);

  return {
    refreshing,
    handleRefresh,
  };
}
