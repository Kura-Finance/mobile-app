import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import i18n from '../../../shared/locales/i18n';
import { BLUE_CHIPS, GECKO_IDS, BluechipToken } from '../config/blueChips';
import type { TokenBalances } from './useBaseBalances';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PortfolioToken {
  token: BluechipToken;
  price: number;
  change24h: number;
  holdings: number;
  value: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CoinGecko price fetch (free tier, no key required)
// ─────────────────────────────────────────────────────────────────────────────

const COINGECKO_URL =
  `https://api.coingecko.com/api/v3/simple/price` +
  `?ids=${GECKO_IDS}&vs_currencies=usd&include_24hr_change=true`;

const CACHE_TTL_MS = 60_000; // 1 minute

let priceCache: Record<string, { usd: number; usd_24h_change: number }> | null = null;
let lastFetchAt = 0;

async function fetchPrices(): Promise<Record<string, { usd: number; usd_24h_change: number }>> {
  const now = Date.now();
  if (priceCache && now - lastFetchAt < CACHE_TTL_MS) return priceCache;

  const res = await fetch(COINGECKO_URL);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = await res.json();
  priceCache = data;
  lastFetchAt = now;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePortfolio(tokenBalances: TokenBalances) {
  const [tokens, setTokens] = useState<PortfolioToken[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balancesRef = useRef(tokenBalances);
  balancesRef.current = tokenBalances;

  // Recompute when on-chain balances arrive or change (initial mount often has {}).
  const holdingsKey = useMemo(
    () => BLUE_CHIPS.map((token) => tokenBalances[token.symbol] ?? 0).join('|'),
    [tokenBalances],
  );

  const applyPrices = useCallback((
    prices: Record<string, { usd: number; usd_24h_change: number }>,
  ) => {
    const balances = balancesRef.current;

    const result: PortfolioToken[] = BLUE_CHIPS.map((token) => {
      const priceData = prices[token.geckoId];
      const price = priceData?.usd ?? 0;
      const change24h = priceData?.usd_24h_change ?? 0;
      const holdings = balances[token.symbol] ?? 0;

      return {
        token,
        price,
        change24h,
        holdings,
        value: holdings * price,
      };
    });

    result.sort((a, b) => {
      if (a.value !== b.value) return b.value - a.value;
      return BLUE_CHIPS.indexOf(a.token) - BLUE_CHIPS.indexOf(b.token);
    });

    setTokens(result);
    setTotalValue(result.reduce((sum, t) => sum + t.value, 0));
    setIsLoading(false);
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError(null);
    try {
      const prices = await fetchPrices();
      applyPrices(prices);
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('crypto.failedLoadPrices'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [applyPrices]);

  useEffect(() => {
    const now = Date.now();
    if (priceCache && now - lastFetchAt < CACHE_TTL_MS) {
      applyPrices(priceCache);
      return;
    }
    void load();
  }, [holdingsKey, load, applyPrices]);

  const refresh = useCallback(() => {
    priceCache = null; // bust cache on manual refresh
    load(true);
  }, [load]);

  return { tokens, totalValue, isLoading, isRefreshing, error, refresh };
}
