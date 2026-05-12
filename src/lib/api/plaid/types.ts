/**
 * Plaintext (decrypted) types that the rest of the app consumes.
 *
 * These are the shapes after we've:
 *   - Pulled `GET /api/plaid/finance-snapshot/encrypted`
 *   - sealedBoxOpen'd each payload key into a SEK
 *   - AES-GCM-decrypted each row's payloadCiphertext into its `*Sensitive`
 *   - Merged metadata + sensitive into one ergonomic record
 *
 * Encryption is invisible above this layer; UI / store consumes plain values.
 */

import type {
  AccountSensitive,
  InvestmentAccountSensitive,
  InvestmentSensitive,
  TransactionSensitive,
} from './schemas';
import type { ApiCacheMetadata } from '../cacheMetadata';

export type PlaidAccountType = 'checking' | 'saving' | 'credit' | 'investment';
export type PlaidAccountBucket = 'banking' | 'investment';

export interface PlaidAccount extends AccountSensitive {
  /** Stable per-Plaid-account id (the same one the dashboard groups by). */
  accountId: string;
  plaidItemId: string | null;
  type: PlaidAccountType;
  bucket: PlaidAccountBucket;
  cachedAt: string;
}

export interface PlaidTransaction extends TransactionSensitive {
  transactionId: string;
  accountId: string;
  plaidItemId: string | null;
  /** ISO date `YYYY-MM-DD`. */
  date: string;
  /** ISO month `YYYY-MM`. */
  month: string;
  isPending: boolean;
  isRecurring: boolean;
  isSubscription: boolean;
  cachedAt: string;
}

export interface PlaidInvestmentAccount extends InvestmentAccountSensitive {
  accountId: string;
  cachedAt: string;
}

export type PlaidInvestmentType = 'stock' | 'crypto' | 'etf' | 'other';

export interface PlaidInvestment extends InvestmentSensitive {
  investmentId: string;
  accountId: string;
  type: PlaidInvestmentType;
  cachedAt: string;
}

export interface PlaidFinanceSnapshot extends ApiCacheMetadata {
  accounts: PlaidAccount[];
  transactions: PlaidTransaction[];
  investmentAccounts: PlaidInvestmentAccount[];
  investments: PlaidInvestment[];
  lastSyncedAt: string | null;
  /** Rows that failed decryption — usually 0; useful for diagnostics only. */
  decryptionFailureCount: number;
}

/**
 * Choose the best logo for a transaction merchant. Order:
 *   1. plaidMerchantLogo (Plaid's enriched canonical logo)
 *   2. merchantLogo      (fallback, e.g. Logo.dev)
 *   3. undefined         (UI renders an initials chip)
 *
 * Don't hardcode a fallback URL here — the backend deliberately stopped
 * serving one and we shouldn't synthesise one client-side either.
 */
export function pickMerchantLogo(tx: PlaidTransaction): string | undefined {
  return tx.plaidMerchantLogo || tx.merchantLogo || undefined;
}
