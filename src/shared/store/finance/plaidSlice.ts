/**
 * Plaid slice — hydrates the finance store from the encrypted snapshot endpoint
 * and projects the decrypted records onto the store-facing shapes.
 *
 * Error + cache strategy:
 *   ┌─ Live fetch fails
 *   │
 *   └─ Network / API error
 *         → Fall back to raw cache (stale-data UX)
 *         → Show error state if cache also misses
 */

import { StateCreator } from 'zustand';
import {
  fetchPlaidFinanceSnapshot,
  fetchPlaidFromCache,
  getPlaidCacheInfo,
  type PlaidAccount,
  type PlaidInvestment,
  type PlaidInvestmentAccount,
  type PlaidTransaction,
} from '../../../lib/api/plaid';
import { CACHE_SOURCE_FROM_CACHE } from '../../../lib/api/cacheMetadata';
import { KuraApiError } from '../../../lib/api/errors';
import Logger from '../../utils/Logger';
import {
  markTrackFiSynced,
  shouldAutoSyncTrackFi,
} from '../../../features/trackfi/utils/trackFiSyncPolicy';

import {
  Account,
  AccountBucket,
  BankingAccountType,
  FinanceState,
  Investment,
  InvestmentAccount,
  InvestmentHoldingType,
  PlaidState,
  Transaction,
} from './types';

function toStoreAccount(acc: PlaidAccount): Account {
  return {
    id: acc.accountId,
    name: acc.name,
    balance: acc.balance,
    type: acc.type as BankingAccountType,
    logo: acc.logo,
    bucket: acc.bucket as AccountBucket,
    plaidItemId: acc.plaidItemId,
    institutionName: acc.institutionName,
    plaidLogo: acc.plaidLogo,
    apy: acc.apy,
    mask: acc.mask,
    cachedAt: acc.cachedAt,
  };
}

function toStoreTransaction(tx: PlaidTransaction): Transaction {
  return {
    id: tx.transactionId,
    accountId: tx.accountId,
    accountName: tx.accountName ?? '',
    accountType: (tx.accountType as BankingAccountType) ?? 'checking',
    amount: tx.amount,
    date: tx.date,
    merchant: tx.merchant,
    category: tx.category,
    type: tx.type,
    month: tx.month,
    isPending: tx.isPending,
    isRecurring: tx.isRecurring,
    isSubscription: tx.isSubscription,
    personalFinanceCategory: tx.personalFinanceCategory,
    recurringFrequency: tx.recurringFrequency,
    enrichedMerchantName: tx.enrichedMerchantName,
    merchantLogo: tx.merchantLogo,
    plaidMerchantLogo: tx.plaidMerchantLogo,
    merchantCategory: tx.merchantCategory,
    plaidItemId: tx.plaidItemId,
    cachedAt: tx.cachedAt,
  };
}

function toStoreInvestmentAccount(acc: PlaidInvestmentAccount): InvestmentAccount {
  return {
    id: acc.accountId,
    name: acc.name,
    type: 'Broker',
    logo: acc.logo,
    institutionName: acc.institutionName,
    plaidLogo: acc.plaidLogo,
    cachedAt: acc.cachedAt,
  };
}

function toStoreInvestment(inv: PlaidInvestment): Investment {
  const usdValue = inv.holdings * inv.currentPrice;
  return {
    id: inv.investmentId,
    accountId: inv.accountId,
    symbol: inv.symbol,
    name: inv.name,
    holdings: inv.holdings,
    currentPrice: inv.currentPrice,
    change24h: inv.change24h ?? 0,
    usdValue,
    type: inv.type as InvestmentHoldingType,
    logo: inv.logo,
    cachedAt: inv.cachedAt,
  };
}

function applySnapshot(
  set: Parameters<StateCreator<FinanceState, [], [], PlaidState>>[0],
  state: Parameters<StateCreator<FinanceState, [], [], PlaidState>>[1],
  snapshot: {
    accounts: PlaidAccount[];
    transactions: PlaidTransaction[];
    investmentAccounts: PlaidInvestmentAccount[];
    investments: PlaidInvestment[];
    lastSyncedAt?: string | null;
    cacheSource?: string;
  },
  cacheLabel?: string,
): void {
  const nextAccounts = snapshot.accounts.map(toStoreAccount);
  const nextTransactions = snapshot.transactions.map(toStoreTransaction);
  const nextPlaidInvAccounts = snapshot.investmentAccounts.map(toStoreInvestmentAccount);
  const nextPlaidInvestments = snapshot.investments.map(toStoreInvestment);

  // ── Stage 3/3: project decrypted records onto the store for display ──
  Logger.info('PlaidSlice', '[3/3] Applying decrypted data to store for display', {
    accounts: nextAccounts.length,
    transactions: nextTransactions.length,
    investmentAccounts: nextPlaidInvAccounts.length,
    investments: nextPlaidInvestments.length,
    source: cacheLabel ?? snapshot.lastSyncedAt ?? 'live',
  });

  set((s) => {
    const nonPlaidAccounts = s.investmentAccounts.filter(
      (a) => a.type === 'Web3 Wallet' || a.type === 'Exchange',
    );
    const nonPlaidInvestments = s.investments.filter((i) =>
      nonPlaidAccounts.some((a) => a.id === i.accountId),
    );
    return {
      accounts: nextAccounts,
      transactions: nextTransactions,
      investmentAccounts: [...nextPlaidInvAccounts, ...nonPlaidAccounts],
      investments: [...nextPlaidInvestments, ...nonPlaidInvestments],
      isLoadingPlaidData: false,
      lastRefreshInfo: null,
      cacheSource: cacheLabel ?? snapshot.cacheSource ?? snapshot.lastSyncedAt ?? null,
    };
  });

  void state;
}

export const createPlaidSlice: StateCreator<FinanceState, [], [], PlaidState> = (set, get) => ({
  isLoadingPlaidData: false,
  plaidError: null,
  lastRefreshInfo: null,
  cacheSource: null,

  hydratePlaidFinanceData: async (_token: string, force: boolean = false) => {
    if (!shouldAutoSyncTrackFi('plaid', { force })) {
      Logger.debug('PlaidSlice', 'Skipping Plaid hydrate — synced within the last hour');
      return;
    }

    set({ isLoadingPlaidData: true, plaidError: null });
    try {
      const snapshot = await fetchPlaidFinanceSnapshot();

      // Diagnostic: an empty decrypted snapshot can mean either (A) the backend
      // has no synced data, or (B) the backend has raw accounts that were
      // encrypted to a different keypair than the one we just established.
      // Comparing against the raw (pre-encryption) cache stats tells them apart.
      if (snapshot.accounts.length === 0) {
        try {
          const { cacheStats } = await getPlaidCacheInfo();
          Logger.warn('PlaidSlice', 'Decrypted snapshot empty — backend raw cache stats', {
            rawAccounts: cacheStats.cachedAccounts,
            rawTransactions: cacheStats.cachedTransactions,
            rawInvestmentAccounts: cacheStats.cachedInvestmentAccounts,
            lastFullSync: cacheStats.lastFullSync,
            diagnosis:
              cacheStats.cachedAccounts > 0
                ? 'backend HAS data but it is not in the encrypted snapshot → likely keypair/public-key mismatch'
                : 'backend has NO synced accounts → connection did not complete or has not synced yet',
          });
        } catch {
          // cache-info is best-effort diagnostic only
        }
      }

      applySnapshot(set, get, snapshot);
      markTrackFiSynced('plaid');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch Plaid finance data';
      const code = error instanceof KuraApiError ? error.code : undefined;

      // Network / API error — try stale cache
      try {
        const cached = await fetchPlaidFromCache();
        if (cached) {
          Logger.warn('PlaidSlice', 'Network error; serving Plaid data from local cache', { message });
          applySnapshot(set, get, cached, CACHE_SOURCE_FROM_CACHE);
          markTrackFiSynced('plaid');
          return;
        }
      } catch {
        // cache miss
      }

      Logger.warn('PlaidSlice', 'Failed to hydrate Plaid data', { message, code });
      set({ isLoadingPlaidData: false, plaidError: message });
      throw error;
    }
  },

  clearPlaidFinanceData: () => {
    set((state) => {
      const nonPlaidAccounts = state.investmentAccounts.filter(
        (account) => account.type === 'Web3 Wallet' || account.type === 'Exchange',
      );
      const nonPlaidInvestments = state.investments.filter((investment) =>
        nonPlaidAccounts.some((account) => account.id === investment.accountId),
      );
      return {
        accounts: [],
        transactions: [],
        investmentAccounts: nonPlaidAccounts,
        investments: nonPlaidInvestments,
        plaidError: null,
      };
    });
  },

  hydrateExchangeAccounts: async (token: string) => {
    try {
      const { useExchangeStore } = await import('../useExchangeStore');
      await useExchangeStore.getState().hydrateExchangeAccounts(token);
    } catch (error) {
      Logger.warn('PlaidSlice', 'Failed to hydrate exchange accounts', {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
