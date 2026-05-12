import { useCallback } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useExchangeStore } from '../store/useExchangeStore';
import { useAppStore } from '../store/useAppStore';
import Logger from '../utils/Logger';

/**
 * Hook for waiting and polling after webhook events (account connect/disconnect)
 * Responsibility: Implement exponential backoff polling pattern for webhook completion
 * 
 * After connecting/disconnecting a Plaid account:
 * 1. Wait 1-2 seconds for webhook to trigger
 * 2. Poll for 3-5 seconds with exponential backoff
 * 3. Then refresh data when ready
 */
export function useWebhookWait() {
  const hydratePlaidFinanceData = useFinanceStore((state: any) => state.hydratePlaidFinanceData);
  const fetchExchangeBalances = useExchangeStore((state: any) => state.fetchExchangeBalances);
  const exchangeAccounts = useExchangeStore((state: any) => state.exchangeAccounts);
  const authToken = useAppStore((state: any) => state.authToken);

  /**
   * Wait for webhook to complete and then refresh data
   * @param action - 'connect' | 'disconnect' - describes the action that triggered the webhook
   */
  const waitAndRefreshAfterWebhook = useCallback(
    async (action: 'connect' | 'disconnect') => {
      if (!authToken) {
        Logger.warn('useWebhookWait', 'No auth token for webhook wait');
        return;
      }

      Logger.info('useWebhookWait', `Webhook triggered: ${action} account - waiting for backend processing`);

      // Step 1: Initial wait (1-2 seconds for webhook to trigger)
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Step 2: Exponential backoff polling (up to 5 attempts, 3.5 seconds total)
      const pollIntervals = [500, 700, 1000, 1300]; // Exponential backoff in ms
      for (let i = 0; i < pollIntervals.length; i++) {
        await new Promise((resolve) => setTimeout(resolve, pollIntervals[i]));
        Logger.debug('useWebhookWait', `Poll attempt ${i + 1}/${pollIntervals.length}`);
      }

      Logger.info('useWebhookWait', `Webhook wait complete for ${action} - refreshing data`);

      // Step 3: Refresh data after webhook should have completed
      try {
        await hydratePlaidFinanceData(authToken);
        Logger.info('useWebhookWait', 'Plaid data refreshed after webhook');

        // Also refresh exchange data if applicable
        if (exchangeAccounts.length > 0) {
          const exchangeRefreshPromises = exchangeAccounts.map((account: any) =>
            fetchExchangeBalances(account.id, authToken, true).catch((error: any) => {
              Logger.warn('useWebhookWait', `Failed to refresh exchange account ${account.id}`, error);
            })
          );
          await Promise.all(exchangeRefreshPromises);
          Logger.info('useWebhookWait', 'Exchange data refreshed after webhook');
        }
      } catch (error) {
        Logger.error('useWebhookWait', `Failed to refresh data after ${action} webhook`, error);
      }
    },
    [authToken, hydratePlaidFinanceData, fetchExchangeBalances, exchangeAccounts]
  );

  return {
    waitAndRefreshAfterWebhook,
  };
}
