import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import i18n from '../../../shared/locales/i18n';
import { coingeckoJson } from '../../../lib/api/coingecko/client';
import { BLUE_CHIPS, GECKO_IDS, BluechipToken } from '../config/blueChips';
import type { TokenBalances } from './useBaseBalances';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PortfolioToken {
  token: BluechipToken;
  price: number;
  change24h: number;
  marketCap: number;
  holdings: number;
  value: number;
}

type PriceRow = { usd: number; usd_24h_change: number; usd_market_cap?: number };
type PriceMap = Record<string, PriceRow>;

// ─────────────────────────────────────────────────────────────────────────────
// CoinGecko price fetch (free tier, optional API key via env)
// ─────────────────────────────────────────────────────────────────────────────

const COINGECKO_URL =
  `/simple/price` +
  `?ids=${GECKO_IDS}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`;

const CACHE_TTL_MS = 3 * 60_000; // 3 minutes — free tier is ~10–30 req/min

let priceCache: PriceMap | null = null;
let lastFetchAt = 0;
let fetchPromise: Promise<PriceMap> | null = null;

async function fetchPrices(force = false): Promise<PriceMap> {
  const now = Date.now();
  if (!force && priceCache && now - lastFetchAt < CACHE_TTL_MS) return priceCache;

  if (!force && fetchPromise) return fetchPromise;

  fetchPromise = coingeckoJson<PriceMap>(COINGECKO_URL)
    .then((data) => {
      priceCache = data;
      lastFetchAt = Date.now();
      return data;
    })
    .finally(() => {
      fetchPromise = null;
    });

  return fetchPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePortfolio(tokenBalances: TokenBalances, options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const [tokens, setTokens] = useState<PortfolioToken[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const balancesRef = useRef(tokenBalances);
  balancesRef.current = tokenBalances;

  const holdingsKey = useMemo(
    () => BLUE_CHIPS.map((token) => tokenBalances[token.symbol] ?? 0).join('|'),
    [tokenBalances],
  );

  const applyPrices = useCallback((prices: PriceMap) => {
    const balances = balancesRef.current;

    const result: PortfolioToken[] = BLUE_CHIPS.map((token) => {
      const priceData = prices[token.geckoId];
      const price = priceData?.usd ?? 0;
      const change24h = priceData?.usd_24h_change ?? 0;
      const marketCap = priceData?.usd_market_cap ?? 0;
      const holdings = balances[token.symbol] ?? 0;

      return {
        token,
        price,
        change24h,
        marketCap,
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

  const load = useCallback(async (opts?: { refresh?: boolean; force?: boolean }) => {
    const isRefresh = opts?.refresh ?? false;
    const force = opts?.force ?? false;

    if (isRefresh) setIsRefreshing(true);
    setError(null);
    try {
      const prices = await fetchPrices(force);
      applyPrices(prices);
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t('crypto.failedLoadPrices');
      if (priceCache) {
        applyPrices(priceCache);
        if (!message.includes('429')) setError(message);
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [applyPrices]);

  // Fetch on mount; balance changes only recompute from cache (no extra API call).
  useEffect(() => {
    if (!enabled) return;
    void load();
  }, [load, enabled]);

  useEffect(() => {
    if (!enabled || !priceCache) return;
    applyPrices(priceCache);
  }, [holdingsKey, applyPrices, enabled]);

  const refresh = useCallback(() => {
    void load({ refresh: true, force: true });
  }, [load]);

  return { tokens, totalValue, isLoading, isRefreshing, error, refresh };
}
