/**
 * Plaid HTTP client + decryption pipeline.
 *
 * Endpoints (all envelope-wrapped `{success,data,error}`):
 *   POST /api/plaid/create-link-token
 *   POST /api/plaid/exchange-public-token
 *   GET  /api/plaid/finance-snapshot/encrypted   ← main read path
 *   POST /api/plaid/disconnect-item
 *   GET  /api/plaid/cache/info
 *
 * `GET /finance-snapshot` (legacy plaintext + refresh-limit) is intentionally
 * NOT wired here — mobile is read-only off the encrypted endpoint; refresh is
 * driven by Plaid webhooks server-side.
 */

import { requestJson } from '../client';
import { parseCacheMetadata } from '../cacheMetadata';
import { decryptEnvelopeRows, type UnwrapEnvelopeOptions } from '../../crypto/envelope';
import { getCryptoSession } from '../../crypto/session';
import {
  encryptedFinanceSnapshotSchema,
  type AccountSensitive,
  type EncryptedAccountRow,
  type EncryptedFinanceSnapshotV1,
  type EncryptedInvestmentAccountRow,
  type EncryptedInvestmentRow,
  type EncryptedTransactionRow,
  type InvestmentAccountSensitive,
  type InvestmentSensitive,
  type TransactionSensitive,
} from './schemas';
import type {
  PlaidAccount,
  PlaidAccountBucket,
  PlaidAccountType,
  PlaidFinanceSnapshot,
  PlaidInvestment,
  PlaidInvestmentAccount,
  PlaidInvestmentType,
  PlaidTransaction,
} from './types';
import { writeRawCache, readRawCache } from '../../cache/dataCache';
import Logger from '../../../shared/utils/Logger';

const PLAID_RAW_CACHE_NS = 'plaid.envelope';

const apiName = 'PlaidApi';

// ─────────────────────────────────────────────────────────────
// Link token / exchange / disconnect / cache info
// ─────────────────────────────────────────────────────────────

export interface CreateLinkTokenResponse {
  link_token: string;
}

export async function createPlaidLinkToken(): Promise<CreateLinkTokenResponse> {
  return requestJson<CreateLinkTokenResponse>('/api/plaid/create-link-token', {
    method: 'POST',
    apiName,
  });
}

export interface ExchangePublicTokenResult {
  message: string;
  snapshot?: unknown;
}

export async function exchangePlaidPublicToken(
  payload: { public_token: string; institution_name?: string },
): Promise<ExchangePublicTokenResult> {
  return requestJson<ExchangePublicTokenResult>('/api/plaid/exchange-public-token', {
    method: 'POST',
    body: JSON.stringify(payload),
    apiName,
  });
}

export interface DisconnectPlaidItemResult {
  message: string;
  data: {
    matchedAccountId?: string;
    disconnectedItemId?: string;
    institution?: string;
    plaidRequestId?: string;
  };
}

export async function disconnectPlaidItem(accountId: string): Promise<DisconnectPlaidItemResult> {
  if (!accountId) {
    throw new Error('disconnectPlaidItem: accountId is required');
  }
  return requestJson<DisconnectPlaidItemResult>('/api/plaid/disconnect-item', {
    method: 'POST',
    body: JSON.stringify({ accountId }),
    apiName,
  });
}

export interface PlaidCacheInfoResponse {
  cacheStats: {
    cachedAccounts: number;
    cachedTransactions: number;
    cachedInvestmentAccounts: number;
    cachedInvestments: number;
    lastFullSync: string | null;
    accountsLastSync: string | null;
    transactionsLastSync: string | null;
    investmentsLastSync: string | null;
  };
}

export async function getPlaidCacheInfo(): Promise<PlaidCacheInfoResponse> {
  return requestJson<PlaidCacheInfoResponse>('/api/plaid/cache/info', {
    method: 'GET',
    apiName,
  });
}

// ─────────────────────────────────────────────────────────────
// Encrypted snapshot — fetch + decrypt
// ─────────────────────────────────────────────────────────────

const ACCOUNT_TYPES: Set<PlaidAccountType> = new Set(['checking', 'saving', 'credit', 'investment']);
const ACCOUNT_BUCKETS: Set<PlaidAccountBucket> = new Set(['banking', 'investment']);
const INVESTMENT_TYPES: Set<PlaidInvestmentType> = new Set(['stock', 'crypto', 'etf', 'other']);

function normalizeAccountType(value: string): PlaidAccountType {
  return ACCOUNT_TYPES.has(value as PlaidAccountType) ? (value as PlaidAccountType) : 'checking';
}

function normalizeAccountBucket(value: string): PlaidAccountBucket {
  return ACCOUNT_BUCKETS.has(value as PlaidAccountBucket) ? (value as PlaidAccountBucket) : 'banking';
}

function normalizeInvestmentType(value: string): PlaidInvestmentType {
  return INVESTMENT_TYPES.has(value as PlaidInvestmentType) ? (value as PlaidInvestmentType) : 'other';
}

// ─────────────────────────────────────────────────────────────
// Shared decrypt helper
// ─────────────────────────────────────────────────────────────

async function decryptEnvelope(
  envelope: EncryptedFinanceSnapshotV1,
  opts: UnwrapEnvelopeOptions = {},
): Promise<PlaidFinanceSnapshot> {
  const startedAt = Date.now();
  // ── Stage 2/3: decrypt ──────────────────────────────────────────────
  // Unwrap each sealed SEK with the X25519 private key, then AES-GCM-decrypt
  // every row. Requires an active crypto session (or explicit opts keys).
  Logger.info(apiName, '[2/3] Decrypting snapshot', {
    sealedKeys: envelope.payloadKeys.length,
    keySource: opts.privateKey ? 'biometric-restore' : 'crypto-session',
    cryptoSession: getCryptoSession() ? 'active' : 'inactive',
  });

  const [accountsResult, transactionsResult, investmentAccountsResult, investmentsResult] =
    await Promise.all([
      decryptEnvelopeRows<AccountSensitive, EncryptedAccountRow>(
        envelope.payloadKeys,
        envelope.accounts,
        opts,
      ),
      decryptEnvelopeRows<TransactionSensitive, EncryptedTransactionRow>(
        envelope.payloadKeys,
        envelope.transactions,
        opts,
      ),
      decryptEnvelopeRows<InvestmentAccountSensitive, EncryptedInvestmentAccountRow>(
        envelope.payloadKeys,
        envelope.investmentAccounts,
        opts,
      ),
      decryptEnvelopeRows<InvestmentSensitive, EncryptedInvestmentRow>(
        envelope.payloadKeys,
        envelope.investments,
        opts,
      ),
    ]);

  const decryptionFailureCount =
    accountsResult.failed.length +
    transactionsResult.failed.length +
    investmentAccountsResult.failed.length +
    investmentsResult.failed.length;

  if (decryptionFailureCount > 0) {
    Logger.warn(apiName, 'Some encrypted plaid rows failed to decrypt', {
      accounts: accountsResult.failed.length,
      transactions: transactionsResult.failed.length,
      investmentAccounts: investmentAccountsResult.failed.length,
      investments: investmentsResult.failed.length,
    });
  }

  const accounts: PlaidAccount[] = accountsResult.decrypted.map(({ row, payload }) => ({
    ...payload,
    accountId: row.accountId,
    plaidItemId: row.plaidItemId,
    type: normalizeAccountType(row.type),
    bucket: normalizeAccountBucket(row.bucket),
    cachedAt: row.cachedAt,
  }));

  const transactions: PlaidTransaction[] = transactionsResult.decrypted.map(({ row, payload }) => ({
    ...payload,
    transactionId: row.transactionId,
    accountId: row.accountId,
    plaidItemId: row.plaidItemId,
    date: row.date,
    month: row.month,
    isPending: row.isPending,
    isRecurring: row.isRecurring,
    isSubscription: row.isSubscription,
    cachedAt: row.cachedAt,
  }));

  const investmentAccounts: PlaidInvestmentAccount[] = investmentAccountsResult.decrypted.map(
    ({ row, payload }) => ({
      ...payload,
      accountId: row.accountId,
      cachedAt: row.cachedAt,
    }),
  );

  const investments: PlaidInvestment[] = investmentsResult.decrypted.map(({ row, payload }) => ({
    ...payload,
    investmentId: row.investmentId,
    accountId: row.accountId,
    type: normalizeInvestmentType(row.type),
    cachedAt: row.cachedAt,
  }));

  Logger.info(apiName, '[2/3] Snapshot decrypted', {
    accounts: accounts.length,
    transactions: transactions.length,
    investmentAccounts: investmentAccounts.length,
    investments: investments.length,
    failed: decryptionFailureCount,
    ms: Date.now() - startedAt,
  });

  return {
    accounts,
    transactions,
    investmentAccounts,
    investments,
    lastSyncedAt: envelope.lastSyncedAt,
    decryptionFailureCount,
    ...parseCacheMetadata(envelope),
  };
}

/**
 * One-shot read path: GET → zod parse → cache raw envelope → decrypt → return plaintext.
 *
 * If a row fails to decrypt (e.g. the matching payloadKey was rotated since
 * the row was written), we drop it and log a warning; the rest of the
 * snapshot still renders.
 */
export async function fetchPlaidFinanceSnapshot(): Promise<PlaidFinanceSnapshot> {
  // ── Stage 1/3: fetch encrypted envelope from backend ────────────────
  Logger.info(apiName, '[1/3] Fetching encrypted finance snapshot from backend');
  const raw = await requestJson<unknown>('/api/plaid/finance-snapshot/encrypted', {
    method: 'GET',
    apiName,
  });
  const envelope = encryptedFinanceSnapshotSchema.parse(raw);

  Logger.info(apiName, '[1/3] Encrypted snapshot received', {
    payloadKeys: envelope.payloadKeys.length,
    accounts: envelope.accounts.length,
    transactions: envelope.transactions.length,
    investmentAccounts: envelope.investmentAccounts.length,
    investments: envelope.investments.length,
  });

  // Persist raw encrypted envelope — no re-encryption needed (data is already E2EE).
  void writeRawCache<EncryptedFinanceSnapshotV1>(PLAID_RAW_CACHE_NS, envelope);

  return decryptEnvelope(envelope);
}

/**
 * Decrypt the most recent locally-cached Plaid envelope.
 *
 * Pass `opts` with `{ privateKey, publicKey }` when the in-memory CryptoSession
 * is unavailable (e.g. after biometric restore following AppLock). If `opts` is
 * omitted the current CryptoSession is used.
 *
 * Returns `null` if no cache exists or if decryption fails (stale SEK).
 */
export async function fetchPlaidFromCache(
  opts?: UnwrapEnvelopeOptions,
): Promise<PlaidFinanceSnapshot | null> {
  try {
    const cached = await readRawCache<EncryptedFinanceSnapshotV1>(PLAID_RAW_CACHE_NS);
    if (!cached) return null;

    Logger.info(apiName, '[1/3] Loaded encrypted snapshot from local cache', {
      cachedAt: cached.cachedAt,
    });
    const envelope = encryptedFinanceSnapshotSchema.parse(cached.data);
    return await decryptEnvelope(envelope, opts);
  } catch (error) {
    Logger.warn(apiName, 'fetchPlaidFromCache failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
