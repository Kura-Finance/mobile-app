/**
 * Aggregated balances for TrackFi hub cards (banking, brokers, DeFi).
 */

import { useMemo } from 'react';
import { features } from '../../../config/features';
import { useDefiPortfolio, walletDataKey } from './useDefiPortfolio';
import type { useTrackFiFinanceData } from './useTrackFiFinanceData';
import { netBankingBalance } from '../utils/bankingBalances';
import {
  getPlaidBrokerAccounts,
  isPlaidBrokerHoldingsPending,
} from '../utils/plaidBrokerHoldings';

export type TrackFiFinanceSnapshot = ReturnType<typeof useTrackFiFinanceData>;

export type DefiPortfolioSnapshot = Pick<
  ReturnType<typeof useDefiPortfolio>,
  'totalUsdValue' | 'watched' | 'isInitialising' | 'walletData'
>;

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

export function useTrackFiHubBalances(
  enabled: boolean,
  finance: TrackFiFinanceSnapshot,
  defiPortfolio: DefiPortfolioSnapshot,
): TrackFiHubBalances {
  const {
    accounts,
    isLoadingPlaidData,
    calculateTotalAssets,
    investments,
    investmentAccounts,
    exchangeAccounts,
    exchangeInvestments,
    exchangeIsLoading,
  } = finance;

  const {
    totalUsdValue: defiTotal,
    watched,
    isInitialising: defiInitialising,
    walletData,
  } = defiPortfolio;

  const bankingTotal = useMemo(() => netBankingBalance(accounts), [accounts]);
  const brokersTotal = useMemo(
    () => calculateTotalAssets(),
    [calculateTotalAssets, investments, exchangeInvestments],
  );

  const anyExchangeLoading = Object.values(exchangeIsLoading).some(Boolean);
  const anyDefiWalletLoading = watched.some(
    (w) => walletData[walletDataKey(w.address)]?.isLoading,
  );

  const plaidBrokerAccounts = getPlaidBrokerAccounts(investmentAccounts);
  const plaidBrokerHoldingsPending = isPlaidBrokerHoldingsPending(investmentAccounts, investments);

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
      (isLoadingPlaidData || anyExchangeLoading || plaidBrokerHoldingsPending),
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
