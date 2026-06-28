import { useEffect, useMemo, useState } from 'react';

import type { StockItem } from './useDinari';
import { fetchYahooMarketMap, type YahooMarketSnapshot } from '../utils/yahooStockStats';

export function useYahooStockMarket(symbols: string[]): Map<string, YahooMarketSnapshot> {
  const [marketBySymbol, setMarketBySymbol] = useState<Map<string, YahooMarketSnapshot>>(
    () => new Map(),
  );

  const fetchKey = useMemo(
    () => [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))].sort().join(','),
    [symbols],
  );

  useEffect(() => {
    const unique = fetchKey ? fetchKey.split(',') : [];
    if (!unique.length) return;

    let cancelled = false;
    void fetchYahooMarketMap(unique).then((fresh) => {
      if (cancelled) return;
      setMarketBySymbol((prev) => {
        const next = new Map(prev);
        for (const [sym, snap] of fresh) next.set(sym, snap);
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [fetchKey]);

  return marketBySymbol;
}

export function applyYahooMarket(
  item: StockItem,
  market: YahooMarketSnapshot | undefined,
): StockItem {
  const price = market?.price ?? 0;
  if (price <= 0) {
    return {
      ...item,
      change24h: market?.change24h ?? item.change24h,
    };
  }

  return {
    ...item,
    price,
    change24h: market?.change24h ?? null,
    value: item.holdings > 0 ? item.holdings * price : item.value,
  };
}
