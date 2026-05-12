/**
 * ============================================================================
 * Deprecated: useFinanceStore
 * 
 * This file is maintained for backwards compatibility.
 * All functionality has been refactored into modular slices in the finance/ 
 * directory for better maintainability and scalability.
 * 
 * Please import from './finance' instead:
 *   import { useFinanceStore } from '../shared/store/finance';
 * ============================================================================
 */

// Re-export everything from the new modular location
export { useFinanceStore } from './finance';
export type {
  // Types
  Account,
  Transaction,
  InvestmentAccount,
  Investment,
  ExchangeAccount,
  ExchangeBalance,
  AssetSnapshot,
  FinanceState,
  // UI State
  UIState,
  // Account State
  AccountState,
  // Plaid State
  PlaidState,
  // Web3 State
  Web3State,
  // History State
  HistoryState,
  // Payloads
  SyncWalletPayload,
  // Types
  ChainMarketMeta,
  CurrencyType,
  TimeRangeType,
} from './finance';
