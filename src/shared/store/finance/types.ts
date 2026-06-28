import type { ExchangeName as _ExchangeName } from '../../../lib/api/exchange';
// Re-export for legacy consumers; new code should import from `lib/api/exchange`.
export type ExchangeName = _ExchangeName;

// ============================================================================
// Refresh Info Type
// ============================================================================

export interface RefreshInfo {
  refreshedAt: string; // ISO string timestamp
  refreshCountRemaining: number;
  refreshLimit: number;
  nextResetAt: string; // ISO string timestamp
}

// ============================================================================
// 基礎資料型別
// ============================================================================

/**
 * Store-facing finance types.
 *
 * The Phase 3 encrypted endpoint (`/api/plaid/finance-snapshot/encrypted`)
 * returns rows whose sensitive fields ship as `payloadCiphertext`. The Plaid
 * lib decrypts them and `plaidSlice.hydratePlaidFinanceData` projects the
 * result onto these shapes so the existing dashboard / investment screens
 * don't have to know about encryption.
 *
 * `id` (store) maps to `accountId` / `transactionId` / `investmentId` on the
 * wire — keep the `id` field name here to avoid a sweep through every UI
 * component in PR-B.
 */

export type BankingAccountType = 'checking' | 'saving' | 'credit' | 'crypto' | 'investment';
export type AccountBucket = 'banking' | 'investment';

export interface Account {
  id: string;
  name: string;
  balance: number;
  type: BankingAccountType;
  logo: string;
  /** Phase 3 metadata */
  bucket?: AccountBucket;
  plaidItemId?: string | null;
  institutionName?: string;
  plaidLogo?: string;
  apy?: number;
  mask?: string;
  /** Credit card limit when provided by Plaid. */
  creditLimit?: number;
  cachedAt?: string;
}

export interface Transaction {
  id: string | number;
  accountId: string;
  accountName: string;
  accountType: BankingAccountType;
  amount: string;
  date: string;
  merchant: string;
  /** Loosened from `'credit'|'deposit'|'transfer'` — backend stores Plaid raw values. */
  type: string;
  category: string;
  month?: string;
  isPending?: boolean;
  isRecurring?: boolean;
  isSubscription?: boolean;
  personalFinanceCategory?: string;
  recurringFrequency?: string;
  enrichedMerchantName?: string;
  merchantLogo?: string;
  plaidMerchantLogo?: string;
  merchantCategory?: string;
  plaidItemId?: string | null;
  cachedAt?: string;
}

export interface InvestmentAccount {
  id: string;
  name: string;
  type: 'Broker' | 'Exchange' | 'Web3 Wallet';
  logo: string;
  institutionName?: string;
  plaidLogo?: string;
  cachedAt?: string;
}

export type InvestmentHoldingType = 'crypto' | 'stock' | 'etf' | 'other';

export interface Investment {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  holdings: number;
  currentPrice: number;
  change24h: number;
  usdValue: number;
  type: InvestmentHoldingType;
  logo: string;
  cachedAt?: string;
}

export interface ExchangeAccount {
  id: string;
  /**
   * Lowercase exchange id. New backend may return any string (e.g. one of
   * {@link ExchangeName}); we don't narrow here so future exchanges don't
   * require a UI compile change.
   */
  exchange: string;
  exchangeDisplayName: string;
  isVerified: boolean;
  isActive: boolean;
  lastVerifiedAt: string;
  icon: string;
}

export interface ExchangeBalance {
  symbol: string;
  free: number;
  used: number;
  total: number;
}

export interface AssetSnapshot {
  /** Unix ms (start of UTC day for the point). */
  timestamp: number;
  /** ISO `YYYY-MM-DD` UTC. */
  date: string;
  /** Sum of all four base metrics. */
  totalAssets: number;
  cashFlow: number;
  plaidInvestment: number;
  cryptoSpot: number;
  defiProtocol: number;
}

// ============================================================================
// Payload 型別
// ============================================================================

export interface SyncWalletPayload {
  address: string;
  chainId: number;
  chainName: string;
  nativeSymbol: string;
  nativeBalance: number;
}

// ============================================================================
// UI State Slice
// ============================================================================

export interface UIState {
  // UI Preferences
  selectedTimeRange: TimeRangeType;
  chartDataByTimeRange: Record<string, number[]>;
  currency: 'usd' | 'eur' | 'twd' | 'cny' | 'jpy' | 'ngn';
  isAiOptedIn: boolean;

  // UI Actions
  toggleAiOptIn: () => void;
  setSelectedTimeRange: (timeRange: TimeRangeType) => void;
  setCurrency: (currency: 'usd' | 'eur' | 'twd' | 'cny' | 'jpy' | 'ngn') => void;
}

// ============================================================================
// Account State Slice
// ============================================================================

export interface AccountState {
  // Data
  accounts: Account[];
  transactions: Transaction[];
  investmentAccounts: InvestmentAccount[];
  investments: Investment[];
  exchangeAccounts: ExchangeAccount[];

  // Actions - Banking Accounts
  setAccounts: (accounts: Account[]) => void;
  setTransactions: (transactions: Transaction[]) => void;
  disconnectBankingAccount: (accountId: string) => Promise<void>;

  // Actions - Investment Accounts
  setInvestmentAccounts: (accounts: InvestmentAccount[]) => void;
  setInvestments: (investments: Investment[]) => void;
  disconnectInvestmentAccount: (accountId: string) => void;
  updateAccountOrder: (
    accountIds: string[],
    investmentAccountIds: string[]
  ) => Promise<void>;

  // Actions - Exchange Accounts
  addExchangeAccount: (account: ExchangeAccount) => void;
  removeExchangeAccount: (exchangeAccountId: string) => void;
}

// ============================================================================
// Plaid State Slice
// ============================================================================

export interface PlaidState {
  // Loading & Error States
  isLoadingPlaidData: boolean;
  plaidError: string | null;

  // Refresh tracking (for quota management)
  lastRefreshInfo: RefreshInfo | null;
  cacheSource: string | null; // e.g. "From cache", "Forced refresh from Plaid API"

  // Actions
  hydratePlaidFinanceData: (token: string, refresh?: boolean) => Promise<void>;
  clearPlaidFinanceData: () => void;
  hydrateExchangeAccounts: (token: string) => Promise<void>;
}

// ============================================================================
// Web3 State Slice
// ============================================================================

export interface Web3State {
  // Actions
  syncConnectedWalletPosition: (payload: SyncWalletPayload) => Promise<void>;
  removeConnectedWalletPosition: (address: string, chainId: number) => void;
}

// ============================================================================
// History State Slice (Asset Performance Tracking)
// ============================================================================

export interface HistoryState {
  // Data
  assetHistory: AssetSnapshot[];
  /** Unix ms when assetHistory was last hydrated from backend. */
  lastRecordedTime: number | null;
  /** Last days window we asked for (used to decide if a refetch is needed). */
  lastFetchedDays: number | null;
  isLoadingAssetHistory: boolean;
  assetHistoryError: string | null;

  // Actions
  /**
   * Fetch `/api/assets/history/encrypted?days=...`, decrypt every row, then
   * aggregate to one point per UTC day with the four base-metric breakdown.
   *
   * Defaults to 365 days; aggregation does forward-fill for missing days.
   */
  hydrateAssetHistory: (days?: number, force?: boolean) => Promise<void>;
  clearAssetHistory: () => void;
  /**
   * Compute the user's "right now" total assets from live store state
   * (Plaid investments + connected exchange balances). Independent of the
   * historical snapshots; used for the performance card's current value.
   */
  calculateTotalAssets: () => number;
}

// ============================================================================
// Combined Finance State
// ============================================================================

export interface FinanceState extends UIState, AccountState, PlaidState, Web3State, HistoryState {}

// ============================================================================
// Chain Metadata
// ============================================================================

export interface ChainMarketMeta {
  coingeckoId: string;
  logo: string;
  fallbackName: string;
}

export type CurrencyType = 'usd' | 'eur' | 'twd' | 'cny' | 'jpy' | 'ngn';
export type TimeRangeType = '1W' | '1M' | '6M' | '1Y';

export const BROKER_TIME_RANGES: TimeRangeType[] = ['1W', '1M', '6M', '1Y'];

export function daysForTimeRange(timeRange: TimeRangeType): number {
  switch (timeRange) {
    case '1W':
      return 7;
    case '1M':
      return 30;
    case '6M':
      return 180;
    case '1Y':
      return 365;
  }
}
