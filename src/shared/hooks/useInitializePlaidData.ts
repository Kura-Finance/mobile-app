import { useEffect } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAppStore } from '../store/useAppStore';
import Logger from '../utils/Logger';

/**
 * One-shot bootstrap hook used by Dashboard / Investment screens.
 *
 * Loads (in this order) on first mount when no data is present yet:
 *   1. Encrypted Plaid finance snapshot
 *   2. Asset history (server-recorded, decrypted client-side)
 *
 * Both fetches are independent — a failure in one doesn't block the other.
 */
export function useInitializePlaidData(enabled = true) {
  const hydratePlaidFinanceData = useFinanceStore((state) => state.hydratePlaidFinanceData);
  const hydrateAssetHistory = useFinanceStore((state) => state.hydrateAssetHistory);
  const accounts = useFinanceStore((state) => state.accounts);
  const assetHistory = useFinanceStore((state) => state.assetHistory);
  const authToken = useAppStore((state) => state.authToken);

  useEffect(() => {
    if (!enabled || !authToken) return;

    const loadPlaid = async () => {
      if (accounts.length > 0) return;
      try {
        await hydratePlaidFinanceData(authToken);
      } catch (error) {
        Logger.warn('useInitializePlaidData', 'Plaid hydration failed', { error: String(error) });
      }
    };

    const loadAssetHistory = async () => {
      if (assetHistory.length > 0) return;
      try {
        await hydrateAssetHistory();
      } catch (error) {
        Logger.warn('useInitializePlaidData', 'Asset history hydration failed', { error: String(error) });
      }
    };

    void loadPlaid();
    void loadAssetHistory();
  }, [
    enabled,
    authToken,
    accounts.length,
    assetHistory.length,
    hydratePlaidFinanceData,
    hydrateAssetHistory,
  ]);
}
