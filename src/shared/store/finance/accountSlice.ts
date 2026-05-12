import { StateCreator } from 'zustand';
import { AccountState, Account, Transaction, InvestmentAccount, Investment, ExchangeAccount, FinanceState } from './types';
import Logger from '../../utils/Logger';

/**
 * Account Slice - 處理核心帳戶增刪改查
 * 包括：銀行帳戶、投資帳戶、交易所帳戶
 */
export const createAccountSlice: StateCreator<FinanceState, [], [], AccountState> = (set) => ({
  // Initial State
  accounts: [],
  transactions: [],
  investmentAccounts: [],
  investments: [],
  exchangeAccounts: [],

  // ========================================================================
  // Banking Account Actions
  // ========================================================================

  setAccounts: (accounts: Account[]) => {
    Logger.debug('AccountSlice', 'Setting accounts', { count: accounts.length });
    set({ accounts });
  },

  setTransactions: (transactions: Transaction[]) => {
    Logger.debug('AccountSlice', 'Setting transactions', { count: transactions.length });
    set({ transactions });
  },

  disconnectBankingAccount: async (accountId: string) => {
    try {
      Logger.debug('AccountSlice', 'Disconnecting banking account', { accountId });

      // Update UI immediately (optimistic update)
      set((state) => ({
        accounts: state.accounts.filter((account) => account.id !== accountId),
        transactions: state.transactions.filter(
          (transaction) => transaction.accountId !== accountId
        ),
      }));

      Logger.info('AccountSlice', 'Banking account disconnected locally');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to disconnect account';
      Logger.error('AccountSlice', 'Failed to disconnect banking account', {
        error: errorMessage,
      });
      throw error;
    }
  },

  // ========================================================================
  // Investment Account Actions
  // ========================================================================

  setInvestmentAccounts: (investmentAccounts: InvestmentAccount[]) => {
    Logger.debug('AccountSlice', 'Setting investment accounts', {
      count: investmentAccounts.length,
    });
    set({ investmentAccounts });
  },

  setInvestments: (investments: Investment[]) => {
    Logger.debug('AccountSlice', 'Setting investments', { count: investments.length });
    set({ investments });
  },

  disconnectInvestmentAccount: (accountId: string) => {
    Logger.debug('AccountSlice', 'Disconnecting investment account', { accountId });
    set((state) => ({
      investmentAccounts: state.investmentAccounts.filter(
        (account) => account.id !== accountId
      ),
      investments: state.investments.filter(
        (investment) => investment.accountId !== accountId
      ),
    }));
    Logger.info('AccountSlice', 'Investment account disconnected');
  },

  updateAccountOrder: async (accountIds: string[], investmentAccountIds: string[]) => {
    try {
      Logger.debug('AccountSlice', 'Updating account order', {
        accountIds,
        investmentAccountIds,
      });

      // Note: Backend sync should be called from parent component or useAppStore
      // This just updates the UI state based on new order
      set((state) => {
        const orderedAccounts = accountIds
          .map((id) => state.accounts.find((a) => a.id === id))
          .filter((a) => a !== undefined) as Account[];

        const orderedInvestmentAccounts = investmentAccountIds
          .map((id) => state.investmentAccounts.find((a) => a.id === id))
          .filter((a) => a !== undefined) as InvestmentAccount[];

        return {
          accounts: [
            ...orderedAccounts,
            ...state.accounts.filter((a) => !accountIds.includes(a.id)),
          ],
          investmentAccounts: [
            ...orderedInvestmentAccounts,
            ...state.investmentAccounts.filter(
              (a) => !investmentAccountIds.includes(a.id)
            ),
          ],
        };
      });

      Logger.info('AccountSlice', 'Account order updated');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to update account order';
      Logger.error('AccountSlice', 'Failed to update account order', {
        error: errorMessage,
      });
      throw error;
    }
  },

  // ========================================================================
  // Exchange Account Actions
  // ========================================================================

  addExchangeAccount: (account: ExchangeAccount) => {
    Logger.debug('AccountSlice', 'Adding exchange account', {
      exchange: account.exchange,
      accountId: account.id,
    });

    set((state) => {
      // Check if account already exists
      const exists = state.exchangeAccounts.some((existing) => existing.id === account.id);

      if (exists) {
        Logger.warn('AccountSlice', 'Exchange account already exists', {
          accountId: account.id,
        });
        return state;
      }

      return {
        exchangeAccounts: [...state.exchangeAccounts, account],
      };
    });

    Logger.info('AccountSlice', 'Exchange account added', {
      exchange: account.exchange,
    });
  },

  removeExchangeAccount: (exchangeAccountId: string) => {
    Logger.debug('AccountSlice', 'Removing exchange account', {
      accountId: exchangeAccountId,
    });

    set((state) => ({
      exchangeAccounts: state.exchangeAccounts.filter(
        (account) => account.id !== exchangeAccountId
      ),
    }));

    Logger.info('AccountSlice', 'Exchange account removed');
  },
});
