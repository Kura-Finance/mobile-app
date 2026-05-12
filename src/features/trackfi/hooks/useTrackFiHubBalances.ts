/**
 * Aggregated balances for TrackFi hub cards (banking, brokers, DeFi).
 */

import { useEffect, useMemo } from 'react';
import { useFinanceStore } from '../../../shared/store/useFinanceStore';
import { useExchangeStore } from '../../../shared/store/useExchangeStore';
import { useAppStore } from '../../../shared/store/useAppStore';
import { features } from '../../../config/features';
import { useDefiPortfolio, walletDataKey } from './useDefiPortfolio';

export interface HubCardBalance {
  total: number;
  isLoading: boolean;
  hasData: boolean;
  detailCount: number;
}

export interface TrackFiHubBalances {
  banking: HubCardBalance;
  brokers: HubCardBalance;
  defi: HubCardBalance;
}

function sumBankingBalance(accounts: { type: string; balance: number }[]): number {
  return accounts.reduce(
    (sum, account) => (account.type === 'credit' ? sum - account.balance : sum + account.balance),
    0,
  );
}

export function useTrackFiHubBalances(enabled: boolean): TrackFiHubBalances {
  const accounts = useFinanceStore((state) => state.accounts);
  const isLoadingPlaidData = useFinanceStore((state) => state.isLoadingPlaidData);
  const calculateTotalAssets = useFinanceStore((state) => state.calculateTotalAssets);
  const investments = useFinanceStore((state) => state.investments);
  const investmentAccounts = useFinanceStore((state) => state.investmentAccounts);

  const exchangeAccounts = useExchangeStore((state) => state.exchangeAccounts);
  const exchangeInvestments = useExchangeStore((state) => state.exchangeInvestments);
  const exchangeIsLoading = useExchangeStore((state) => state.isLoading);

  const authToken = useAppStore((state) => state.authToken);

  const {
    totalUsdValue: defiTotal,
    watched,
    isInitialising: defiInitialising,
    loadCached,
    walletData,
  } = useDefiPortfolio();

  useEffect(() => {
    if (!enabled || !authToken || exchangeAccounts.length > 0) return;
    useExchangeStore
      .getState()
      .hydrateExchangeAccounts(authToken)
      .catch(() => {
        // Errors surface in the exchange store.
      });
  }, [enabled, authToken, exchangeAccounts.length]);

  useEffect(() => {
    if (!enabled || !features.debank || defiInitialising) return;
    void loadCached();
  }, [enabled, defiInitialising, loadCached]);

  const bankingTotal = useMemo(() => sumBankingBalance(accounts), [accounts]);
  const brokersTotal = useMemo(() => calculateTotalAssets(), [calculateTotalAssets, investments, exchangeInvestments]);

  const anyExchangeLoading = Object.values(exchangeIsLoading).some(Boolean);
  const anyDefiWalletLoading = watched.some(
    (w) => walletData[walletDataKey(w.address)]?.isLoading,
  );

  const plaidBrokerAccounts = investmentAccounts.filter(
    (acc) => acc.type !== 'Exchange' && acc.type !== 'Web3 Wallet',
  );

  const banking: HubCardBalance = {
    total: bankingTotal,
    isLoading: enabled && isLoadingPlaidData && accounts.length === 0,
    hasData: accounts.length > 0,
    detailCount: accounts.length,
  };

  const brokersHasData =
    investments.length > 0 ||
    exchangeInvestments.length > 0 ||
    plaidBrokerAccounts.length > 0 ||
    exchangeAccounts.length > 0;

  const brokers: HubCardBalance = {
    total: brokersTotal,
    isLoading:
      enabled &&
      brokersTotal === 0 &&
      (isLoadingPlaidData || anyExchangeLoading) &&
      !brokersHasData,
    hasData: brokersHasData,
    detailCount: plaidBrokerAccounts.length + exchangeAccounts.length,
  };

  const defi: HubCardBalance = {
    total: defiTotal,
    isLoading:
      enabled &&
      features.debank &&
      (defiInitialising || (watched.length > 0 && anyDefiWalletLoading && defiTotal === 0)),
    hasData: watched.length > 0,
    detailCount: watched.length,
  };

  return { banking, brokers, defi };
}
