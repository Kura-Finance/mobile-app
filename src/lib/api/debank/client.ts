/**
 * DeBank data client — Kura backend proxy only.
 *
 * The mobile app NEVER calls DeBank OpenAPI (openapi.debank.com). All requests
 * go through the Kura backend, which holds the DeBank API key and caches snapshots:
 *
 *   GET    /api/debank/protocols?address=0x...&refresh=true|false
 *   GET    /api/debank/tokens?address=0x...&refresh=true|false
 *   DELETE /api/debank/addresses/:address
 *
 * `refresh=true` tells the backend to sync from DeBank; the client only sets that
 * on explicit pull-to-refresh.
 */

import { assertKuraBackend } from '../../../config/env';
import { requestJson } from '../client';
import {
  mergeRateLimitWithCacheMetadata,
  parseCacheMetadata,
} from '../cacheMetadata';
import { decryptEnvelopeRows } from '../../crypto/envelope';
import {
  debankProtocolPayloadSchema,
  debankTokenPayloadSchema,
  encryptedDeBankProtocolSnapshotSchema,
  encryptedDeBankTokenSnapshotSchema,
  unlinkDebankAddressResponseSchema,
  type DeBankProtocolPayload,
  type DeBankTokenPayload,
  type EncryptedDeBankProtocolRow,
  type EncryptedDeBankTokenRow,
} from './schemas';
import { normalizeDeBankProtocol, normalizeDeBankToken, normalizeEvmAddress } from './normalize';
import type {
  DeBankProtocol,
  DeBankProtocolsResult,
  DeBankToken,
  DeBankTokensResult,
  UnlinkDeBankAddressResult,
} from './types';
import Logger from '../../../shared/utils/Logger';

const apiName = 'DeBankProxy';

function buildQuery(address: string, refresh: boolean): string {
  const params = new URLSearchParams({ address });
  if (refresh) params.set('refresh', 'true');
  return `?${params.toString()}`;
}

// ─────────────────────────────────────────────────────────────
// Protocols
// ─────────────────────────────────────────────────────────────

export async function fetchDeBankProtocols(
  address: string,
  refresh: boolean = false,
): Promise<DeBankProtocolsResult> {
  assertKuraBackend();
  const normalized = normalizeEvmAddress(address);
  const raw = await requestJson<unknown>(
    `/api/debank/protocols${buildQuery(normalized, refresh)}`,
    { method: 'GET', apiName },
  );
  const envelope = encryptedDeBankProtocolSnapshotSchema.parse(raw);
  const cacheMeta = parseCacheMetadata(envelope);

  const { decrypted, failed } = await decryptEnvelopeRows<
    DeBankProtocolPayload,
    EncryptedDeBankProtocolRow
  >(envelope.payloadKeys, envelope.protocols);

  if (failed.length > 0) {
    Logger.warn(apiName, 'Some DeBank protocol rows failed to decrypt', {
      address: normalized,
      failed: failed.length,
    });
  }

  const protocols: DeBankProtocol[] = [];
  for (const { row, payload } of decrypted) {
    try {
      const validated = debankProtocolPayloadSchema.parse(payload);
      const normalisedProtocol = normalizeDeBankProtocol({
        rawData: validated.rawData,
        protocolId: row.protocolId,
        chain: row.chain,
        cachedAt: row.cachedAt,
      });
      if (normalisedProtocol) protocols.push(normalisedProtocol);
    } catch (error) {
      Logger.warn(apiName, 'Failed to normalise protocol row', {
        protocolId: row.protocolId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    address: envelope.address,
    protocols,
    total: envelope.total,
    decryptionFailureCount: failed.length,
    rateLimitInfo: mergeRateLimitWithCacheMetadata(envelope.rateLimitInfo, cacheMeta),
    ...cacheMeta,
  };
}

// ─────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────

export async function fetchDeBankTokens(
  address: string,
  refresh: boolean = false,
): Promise<DeBankTokensResult> {
  assertKuraBackend();
  const normalized = normalizeEvmAddress(address);
  const raw = await requestJson<unknown>(
    `/api/debank/tokens${buildQuery(normalized, refresh)}`,
    { method: 'GET', apiName },
  );
  const envelope = encryptedDeBankTokenSnapshotSchema.parse(raw);
  const cacheMeta = parseCacheMetadata(envelope);

  const { decrypted, failed } = await decryptEnvelopeRows<
    DeBankTokenPayload,
    EncryptedDeBankTokenRow
  >(envelope.payloadKeys, envelope.tokens);

  if (failed.length > 0) {
    Logger.warn(apiName, 'Some DeBank token rows failed to decrypt', {
      address: normalized,
      failed: failed.length,
    });
  }

  const tokens: DeBankToken[] = [];
  for (const { row, payload } of decrypted) {
    try {
      const validated = debankTokenPayloadSchema.parse(payload);
      const normalisedToken = normalizeDeBankToken({
        rawData: validated.rawData,
        symbol: validated.symbol,
        chain: row.chain,
        tokenId: row.tokenId,
        cachedAt: row.cachedAt,
      });
      if (normalisedToken) tokens.push(normalisedToken);
    } catch (error) {
      Logger.warn(apiName, 'Failed to normalise token row', {
        tokenId: row.tokenId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    address: envelope.address,
    tokens,
    total: envelope.total,
    decryptionFailureCount: failed.length,
    rateLimitInfo: mergeRateLimitWithCacheMetadata(envelope.rateLimitInfo, cacheMeta),
    ...cacheMeta,
  };
}

// ─────────────────────────────────────────────────────────────
// Unlink address
// ─────────────────────────────────────────────────────────────

export async function unlinkDeBankAddress(
  address: string,
): Promise<UnlinkDeBankAddressResult> {
  assertKuraBackend();
  const normalized = normalizeEvmAddress(address);
  const raw = await requestJson<unknown>(
    `/api/debank/addresses/${encodeURIComponent(normalized)}`,
    { method: 'DELETE', apiName },
  );
  const parsed = unlinkDebankAddressResponseSchema.parse(raw);
  if (!parsed.unlinked) {
    throw new Error('DeBank unlink did not complete');
  }
  return {
    address: parsed.address,
    unlinked: true,
    deletedProtocolCount: parsed.deletedProtocolCount,
    deletedTokenCount: parsed.deletedTokenCount,
  };
}
