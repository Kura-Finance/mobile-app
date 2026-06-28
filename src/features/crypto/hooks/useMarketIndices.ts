import { useCallback, useEffect, useState } from 'react';

import {
  fetchMarketIndices,
  getUsMarketStatus,
  type MarketIndicesSnapshot,
} from '../../../lib/api/marketIndices/client';

const CACHE_TTL_MS = 5 * 60_000;

let cache: MarketIndicesSnapshot | null = null;

export function useMarketIndices(enabled = true) {
  const [data, setData] = useState<MarketIndicesSnapshot | null>(() => {
    if (!enabled || !cache) return null;
    if (Date.now() - cache.fetchedAt >= CACHE_TTL_MS) return null;
    return { ...cache, usMarketStatus: getUsMarketStatus() };
  });
  const [loading, setLoading] = useState(enabled && !data);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const now = Date.now();
    if (!force && cache && now - cache.fetchedAt < CACHE_TTL_MS) {
      setData({ ...cache, usMarketStatus: getUsMarketStatus() });
      setLoading(false);
      return;
    }

    if (!cache) setLoading(true);
    setError(null);

    try {
      const next = await fetchMarketIndices();
      cache = next;
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load market indices');
      if (cache) {
        setData({ ...cache, usMarketStatus: getUsMarketStatus() });
      }
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !data) return undefined;

    const id = setInterval(() => {
      setData((prev) => (prev ? { ...prev, usMarketStatus: getUsMarketStatus() } : prev));
    }, 60_000);

    return () => clearInterval(id);
  }, [data, enabled]);

  const refresh = useCallback(() => {
    cache = null;
    void load(true);
  }, [load]);

  return { data, loading, error, refresh };
}
