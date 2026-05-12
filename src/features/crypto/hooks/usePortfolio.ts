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

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    setError(null);
    try {
      const prices = await fetchPrices();
      const balances = balancesRef.current;

      const result: PortfolioToken[] = BLUE_CHIPS.map((token) => {
        const priceData = prices[token.geckoId];
        const price = priceData?.usd ?? 0;
        const change24h = priceData?.usd_24h_change ?? 0;

        // Look up holdings by symbol from on-chain balance data
        const holdings = balances[token.symbol] ?? 0;

        return {
          token,
          price,
          change24h,
          holdings,
          value: holdings * price,
        };
      });

      // Sort: tokens with holdings first (by value desc), then by market order
      result.sort((a, b) => {
        if (a.value !== b.value) return b.value - a.value;
        // Preserve original order for zero-holding tokens
        return BLUE_CHIPS.indexOf(a.token) - BLUE_CHIPS.indexOf(b.token);
      });

      const total = result.reduce((sum, t) => sum + t.value, 0);
      setTokens(result);
      setTotalValue(total);
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('crypto.failedLoadPrices'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [holdingsKey, load]);

  const refresh = useCallback(() => {
    priceCache = null; // bust cache on manual refresh
    load(true);
  }, [load]);

  return { tokens, totalValue, isLoading, isRefreshing, error, refresh };
}
