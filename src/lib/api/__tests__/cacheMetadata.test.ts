import { describe, expect, test } from 'vitest';
import {
  CACHE_SOURCE_FROM_CACHE,
  CACHE_SOURCE_RATE_LIMIT_FALLBACK,
  apiCacheMetadataSchema,
  forcedRefreshCacheSource,
  mergeRateLimitWithCacheMetadata,
  parseCacheMetadata,
} from '../cacheMetadata';

describe('cacheMetadata constants', () => {
  test('forced refresh labels name the provider', () => {
    expect(forcedRefreshCacheSource('Plaid')).toBe('Forced refresh from Plaid API');
    expect(forcedRefreshCacheSource('DeBank')).toBe('Forced refresh from DeBank API');
    expect(forcedRefreshCacheSource('Exchange')).toBe('Forced refresh from Exchange API');
  });

  test('canonical cache + rate-limit fallback strings', () => {
    expect(CACHE_SOURCE_FROM_CACHE).toBe('From cache');
    expect(CACHE_SOURCE_RATE_LIMIT_FALLBACK).toBe(
      'Daily refresh limit reached, showing last synced data',
    );
  });
});

describe('apiCacheMetadataSchema', () => {
  test('parses optional wire fields', () => {
    const parsed = apiCacheMetadataSchema.parse({
      _cacheSource: CACHE_SOURCE_FROM_CACHE,
      _limitReached: false,
    });
    expect(parseCacheMetadata(parsed)).toEqual({
      cacheSource: CACHE_SOURCE_FROM_CACHE,
      limitReached: false,
      message: undefined,
    });
  });
});

describe('mergeRateLimitWithCacheMetadata', () => {
  test('returns existing rateLimitInfo when not limited', () => {
    const info = { remaining: 2, limit: 5, limitReached: false };
    expect(mergeRateLimitWithCacheMetadata(info, { limitReached: false })).toEqual(info);
  });

  test('marks limit reached and preserves quota from rateLimitInfo', () => {
    const merged = mergeRateLimitWithCacheMetadata(
      { remaining: 0, limit: 5, limitReached: false },
      {
        limitReached: true,
        cacheSource: CACHE_SOURCE_RATE_LIMIT_FALLBACK,
        message: 'Quota exhausted',
      },
    );
    expect(merged).toEqual({
      remaining: 0,
      limit: 5,
      limitReached: true,
      message: 'Quota exhausted',
    });
  });
});
