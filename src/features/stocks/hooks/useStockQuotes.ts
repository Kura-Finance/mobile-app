import { useEffect, useMemo, useState } from 'react';

import {
  fetchYahooMarketMap,
  readCachedYahooMarket,
  type YahooMarketSnapshot,
} from '../utils/yahooStockStats';

export interface StockQuotesResult {
  quotes: Map<string, YahooMarketSnapshot>;
  loading: boolean;
}

/** Fetch Yahoo quotes for the given symbols; reuses module cache between pages. */
export function useStockQuotes(symbols: string[]): StockQuotesResult {
  const [quotes, setQuotes] = useState<Map<string, YahooMarketSnapshot>>(() => new Map());
  const [loading, setLoading] = useState(false);

  const symbolsKey = useMemo(
    () => [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))].sort().join(','),
    [symbols],
  );

  useEffect(() => {
    const unique = symbolsKey ? symbolsKey.split(',') : [];
    if (!unique.length) {
      setLoading(false);
      return;
    }

    setQuotes((prev) => {
      const next = new Map(prev);
      for (const symbol of unique) {
        const cached = readCachedYahooMarket(symbol);
        if (cached) next.set(symbol, cached);
      }
      return next;
    });

    const allCached = unique.every((symbol) => readCachedYahooMarket(symbol) != null);
    if (!allCached) {
      setLoading(true);
    }

    let cancelled = false;
    void fetchYahooMarketMap(unique).then((fresh) => {
      if (cancelled) return;
      setQuotes((prev) => {
        const next = new Map(prev);
        fresh.forEach((value, key) => next.set(key, value));
        return next;
      });
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [symbolsKey]);

  return { quotes, loading };
}
