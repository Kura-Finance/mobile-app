import { useEffect, useRef } from 'react';
import { useFinanceStore } from '../store/finance';
import { useSessionUsable, getUsableAuthToken } from '../../lib/security/sessionAccess';
import Logger from '../utils/Logger';
import {
  getPlaidBrokerAccounts,
  hasPlaidBrokerHoldings,
} from '../../features/trackfi/utils/plaidBrokerHoldings';

/**
 * One-shot bootstrap hook used by Dashboard / Investment screens.
 *
 * Loads (in this order) on first mount when no data is present yet:
 *   1. Encrypted Plaid finance snapshot
 *   2. Asset history (server-recorded, decrypted client-side)
 *
 * Re-runs with force when `unlockSeq` bumps after TrackFi passkey unlock.
 */
export function useInitializePlaidData(enabled = true, unlockSeq = 0) {
  const hydratePlaidFinanceData = useFinanceStore((state) => state.hydratePlaidFinanceData);
  const hydrateAssetHistory = useFinanceStore((state) => state.hydrateAssetHistory);
  const accounts = useFinanceStore((state) => state.accounts);
  const investments = useFinanceStore((state) => state.investments);
  const investmentAccounts = useFinanceStore((state) => state.investmentAccounts);
  const assetHistory = useFinanceStore((state) => state.assetHistory);
  const sessionUsable = useSessionUsable();
  const prevUnlockSeqRef = useRef(0);

  useEffect(() => {
    if (!enabled || !sessionUsable) return;

    const authToken = getUsableAuthToken();
    if (!authToken) return;

    const unlockedAgain = unlockSeq > 0 && unlockSeq !== prevUnlockSeqRef.current;
    prevUnlockSeqRef.current = unlockSeq;

    const loadPlaid = async () => {
      const hasBanking = accounts.length > 0;
      const plaidBrokerAccounts = getPlaidBrokerAccounts(investmentAccounts);
      const hasPlaidBrokerAccounts = plaidBrokerAccounts.length > 0;
      const brokerHoldingsReady = hasPlaidBrokerHoldings(investmentAccounts, investments);
      const brokerDataReady = !hasPlaidBrokerAccounts || brokerHoldingsReady;
      const needsBrokerHoldings = hasPlaidBrokerAccounts && !brokerHoldingsReady;
      if (!unlockedAgain && hasBanking && brokerDataReady) return;
      try {
        await hydratePlaidFinanceData(authToken, unlockedAgain || needsBrokerHoldings);
      } catch (error) {
        Logger.warn('useInitializePlaidData', 'Plaid hydration failed', { error: String(error) });
      }
    };

    const loadAssetHistory = async () => {
      if (!unlockedAgain && assetHistory.length > 0) return;
      try {
        await hydrateAssetHistory(undefined, unlockedAgain);
      } catch (error) {
        Logger.warn('useInitializePlaidData', 'Asset history hydration failed', { error: String(error) });
      }
    };

    void loadPlaid();
    void loadAssetHistory();
  }, [
    enabled,
    sessionUsable,
    unlockSeq,
    accounts.length,
    investments.length,
    investmentAccounts.length,
    assetHistory.length,
    hydratePlaidFinanceData,
    hydrateAssetHistory,
  ]);
}
