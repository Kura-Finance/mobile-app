import { useState, useCallback } from 'react';
import { useFinanceStore } from '../../../../shared/store/useFinanceStore';
import { useExchangeStore } from '../../../../shared/store/useExchangeStore';
import { useAppStore } from '../../../../shared/store/useAppStore';
import Logger from '../../../../shared/utils/Logger';

/**
 * Hook for managing Dashboard data refresh with pull-to-refresh UI state
 * Responsibility: Refresh Plaid finance data (accounts & transactions) and Exchange cryptocurrencies
 */
export function useRefreshDashboardData() {
  const [refreshing, setRefreshing] = useState(false);
  const hydratePlaidFinanceData = useFinanceStore((state: any) => state.hydratePlaidFinanceData);
  const exchangeAccounts = useFinanceStore((state: any) => state.exchangeAccounts);
  const fetchExchangeBalances = useExchangeStore((state: any) => state.fetchExchangeBalances);
  const authToken = useAppStore((state: any) => state.authToken);

  const handleRefresh = useCallback(async () => {
    if (!authToken) {
      Logger.warn('useRefreshDashboardData', 'No auth token available');
      return;
    }

    setRefreshing(true);
    try {
      Logger.debug('useRefreshDashboardData', 'Refreshing Plaid data and exchange accounts');
      
      // Refresh Plaid data
      await hydratePlaidFinanceData(authToken, true);
      Logger.info('useRefreshDashboardData', 'Plaid data refreshed successfully');
      
      // Refresh exchange accounts in parallel
      if (exchangeAccounts && exchangeAccounts.length > 0) {
        const exchangeRefreshPromises = exchangeAccounts.map((account: any) =>
          fetchExchangeBalances(account.id, authToken, true).catch((error: any) => {
            Logger.error('useRefreshDashboardData', `Failed to refresh exchange ${account.exchange}`, {
              accountId: account.id,
              error,
            });
            // Don't throw - continue refreshing other accounts if one fails
          })
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
  }, [authToken, hydratePlaidFinanceData, exchangeAccounts, fetchExchangeBalances]);

  return {
    refreshing,
    handleRefresh,
  };
}
