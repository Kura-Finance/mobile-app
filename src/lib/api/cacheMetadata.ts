/**
 * Unified `_cacheSource` / `_limitReached` / `_message` metadata on TrackFi API envelopes.
 *
 * Backend source of truth for the string values; mobile parses and surfaces them
 * without re-deriving labels client-side.
 */

import { z } from 'zod';
import type { RateLimitInfo } from './exchange/schemas';

export const CACHE_SOURCE_FROM_CACHE = 'From cache' as const;

export const CACHE_SOURCE_RATE_LIMIT_FALLBACK =
  'Daily refresh limit reached, showing last synced data' as const;

export type CacheProvider = 'Plaid' | 'DeBank' | 'Exchange';

export function forcedRefreshCacheSource(provider: CacheProvider): string {
  return `Forced refresh from ${provider} API`;
}

export const apiCacheMetadataSchema = z.object({
  _cacheSource: z.string().optional(),
  _limitReached: z.boolean().optional(),
  _message: z.string().optional(),
});
export type ApiCacheMetadataWire = z.infer<typeof apiCacheMetadataSchema>;

export interface ApiCacheMetadata {
  cacheSource?: string;
  limitReached?: boolean;
  message?: string;
}

export function parseCacheMetadata(wire: ApiCacheMetadataWire): ApiCacheMetadata {
  return {
    cacheSource: wire._cacheSource,
    limitReached: wire._limitReached,
    message: wire._message,
  };
}

/**
 * When the backend falls back to cached data due to daily refresh limits,
 * `_limitReached` is true and `rateLimitInfo` may still carry quota numbers.
 */
export function mergeRateLimitWithCacheMetadata(
  rateLimitInfo: RateLimitInfo | undefined,
  meta: ApiCacheMetadata,
): RateLimitInfo | undefined {
  if (!meta.limitReached) {
    return rateLimitInfo;
  }
  return {
    remaining: rateLimitInfo?.remaining ?? 0,
    limit: rateLimitInfo?.limit ?? 0,
    limitReached: true,
    message: meta.message ?? meta.cacheSource ?? CACHE_SOURCE_RATE_LIMIT_FALLBACK,
  };
}
