/**
 * Exchange HTTP client + Phase 3 decryption pipeline.
 *
 * Endpoints:
 *   GET    /api/exchange/supported            → { exchanges, metadata }
 *   POST   /api/exchange/connect              → { account, rateLimitInfo? }
 *   GET    /api/exchange/accounts             → { accounts, metadata }
 *   GET    /api/exchange/:id/balances         → encrypted snapshot
 *   DELETE /api/exchange/:id                  → { message? }
 */

import { requestJson } from '../client';
import {
  mergeRateLimitWithCacheMetadata,
  parseCacheMetadata,
} from '../cacheMetadata';
import { decryptEnvelopeRows } from '../../crypto/envelope';
import {
  assetPayloadSchema,
  balancePayloadSchema,
  connectExchangeResponseSchema,
  encryptedExchangeSnapshotSchema,
  exchangeAccountsResponseSchema,
  supportedExchangesResponseSchema,
  type AssetPayload,
  type BalancePayload,
  type EncryptedExchangeRow,
  type RateLimitInfo,
  type SupportedExchange,
} from './schemas';
import type {
  ExchangeAccount,
  ExchangeAsset,
  ExchangeBalance,
  ExchangeCredentials,
  ExchangeSnapshot,
} from './types';
import Logger from '../../../shared/utils/Logger';

const apiName = 'ExchangeApi';

const HEX_ACCOUNT_ID_GUARD = /^[A-Za-z0-9_-]+$/;

function assertAccountId(id: string): string {
  if (!id || !HEX_ACCOUNT_ID_GUARD.test(id)) {
    throw new Error('Invalid exchangeAccountId');
  }
  return id;
}

// ─────────────────────────────────────────────────────────────
// Supported / accounts / connect / disconnect
// ─────────────────────────────────────────────────────────────

export async function getSupportedExchanges(): Promise<SupportedExchange[]> {
  const raw = await requestJson<unknown>('/api/exchange/supported', {
    method: 'GET',
    apiName,
    skipAuth: true,
  });
  return supportedExchangesResponseSchema.parse(raw).exchanges;
}

export interface ConnectExchangeResult {
  account: ExchangeAccount;
  rateLimitInfo?: RateLimitInfo;
}

export async function connectExchange(
  credentials: ExchangeCredentials,
): Promise<ConnectExchangeResult> {
  const body: Record<string, string> = {
    exchange: credentials.exchange.toLowerCase(),
    apiKey: credentials.apiKey,
    apiSecret: credentials.apiSecret,
  };
  if (credentials.passphrase) {
    body.passphrase = credentials.passphrase;
  }
  const raw = await requestJson<unknown>('/api/exchange/connect', {
    method: 'POST',
    body: JSON.stringify(body),
    apiName,
  });
  const parsed = connectExchangeResponseSchema.parse(raw);
  return {
    account: {
      id: parsed.account.id,
      exchange: parsed.account.exchange,
      exchangeDisplayName: parsed.account.exchangeDisplayName,
      icon: parsed.account.icon,
      isVerified: parsed.account.isVerified,
    },
    rateLimitInfo: parsed.rateLimitInfo,
  };
}

export async function getExchangeAccounts(): Promise<ExchangeAccount[]> {
  const raw = await requestJson<unknown>('/api/exchange/accounts', {
    method: 'GET',
    apiName,
  });
  const parsed = exchangeAccountsResponseSchema.parse(raw);
  return parsed.accounts.map((a) => ({
    id: a.id,
    exchange: a.exchange,
    exchangeDisplayName: a.exchangeDisplayName,
    icon: a.icon,
    isVerified: a.isVerified,
    isActive: a.isActive,
    lastVerifiedAt: a.lastVerifiedAt,
  }));
}

export async function disconnectExchange(exchangeAccountId: string): Promise<{ message?: string }> {
  assertAccountId(exchangeAccountId);
  return requestJson<{ message?: string }>(`/api/exchange/${exchangeAccountId}`, {
    method: 'DELETE',
    apiName,
  });
}

// ─────────────────────────────────────────────────────────────
// Encrypted balances + assets snapshot
// ─────────────────────────────────────────────────────────────

/**
 * Fetch + decrypt one exchange account's balance + asset snapshot.
 *
 * Rows that fail individual decryption are dropped and counted in
 * `decryptionFailureCount`; the rest of the snapshot still renders.
 */
export async function fetchExchangeSnapshot(
  exchangeAccountId: string,
): Promise<ExchangeSnapshot> {
  assertAccountId(exchangeAccountId);
  const raw = await requestJson<unknown>(`/api/exchange/${exchangeAccountId}/balances`, {
    method: 'GET',
    apiName,
  });
  const envelope = encryptedExchangeSnapshotSchema.parse(raw);
  const cacheMeta = parseCacheMetadata(envelope);

  const [balancesResult, assetsResult] = await Promise.all([
    decryptEnvelopeRows<BalancePayload, EncryptedExchangeRow>(
      envelope.payloadKeys,
      envelope.balances,
    ),
    decryptEnvelopeRows<AssetPayload, EncryptedExchangeRow>(
      envelope.payloadKeys,
      envelope.assets,
    ),
  ]);

  const decryptionFailureCount = balancesResult.failed.length + assetsResult.failed.length;
  if (decryptionFailureCount > 0) {
    Logger.warn(apiName, 'Some exchange rows failed to decrypt', {
      accountId: envelope.account.id,
      balanceFailures: balancesResult.failed.length,
      assetFailures: assetsResult.failed.length,
    });
  }

  const balances: ExchangeBalance[] = [];
  for (const { row, payload } of balancesResult.decrypted) {
    try {
      const validated = balancePayloadSchema.parse(payload);
      balances.push({
        symbol: row.symbol,
        cachedAt: row.cachedAt,
        ...validated,
      });
    } catch (error) {
      Logger.warn(apiName, 'Balance payload schema validation failed', {
        symbol: row.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const assets: ExchangeAsset[] = [];
  for (const { row, payload } of assetsResult.decrypted) {
    try {
      const validated = assetPayloadSchema.parse(payload);
      assets.push({
        symbol: row.symbol,
        cachedAt: row.cachedAt,
        ...validated,
      });
    } catch (error) {
      Logger.warn(apiName, 'Asset payload schema validation failed', {
        symbol: row.symbol,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const assetsUsdTotal = assets.reduce((sum, asset) => sum + asset.value, 0);

  return {
    account: envelope.account,
    balances,
    assets,
    assetsUsdTotal,
    rateLimitInfo: mergeRateLimitWithCacheMetadata(envelope.rateLimitInfo, cacheMeta),
    decryptionFailureCount,
    ...cacheMeta,
  };
}
