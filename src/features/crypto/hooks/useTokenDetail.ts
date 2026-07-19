/**
 * useTokenDetail
 *
 * Fetches CoinGecko market chart (for the price graph) and coin market stats
 * (market cap, volume, supply, ATH, ranges, description) for a single token.
 *
 * Free CoinGecko tier — results are cached per (geckoId, timeframe) to avoid
 * hammering the rate limit while the user flips between timeframes.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import i18n from '../../../shared/locales/i18n';
import { coingeckoJson } from '../../../lib/api/coingecko/client';

export type Timeframe = '24H' | '1W' | '1M' | '6M' | '1Y';

export const TIMEFRAMES: Timeframe[] = ['24H', '1W', '1M', '6M', '1Y'];

const DAYS_BY_TF: Record<Timeframe, string> = {
  '24H': '1',
  '1W': '7',
  '1M': '30',
  '6M': '180',
  '1Y': '365',
};

export interface TokenStats {
  marketCapRank: number | null;
  marketCap: number | null;
  totalVolume: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  ath: number | null;
  athDate: string | null;
  high24h: number | null;
  low24h: number | null;
  low52w: number | null;
  high52w: number | null;
  description: string | null;
}

interface ChartCacheEntry {
  prices: number[];
  fetchedAt: number;
}

const chartCache = new Map<string, ChartCacheEntry>();
const statsCache = new Map<string, { stats: TokenStats; fetchedAt: number }>();
const CHART_TTL = 120_000;
const STATS_TTL = 5 * 60_000;

async function fetchChart(geckoId: string, tf: Timeframe): Promise<number[]> {
  const key = `${geckoId}:${tf}`;
  const cached = chartCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CHART_TTL) return cached.prices;

  const url =
    `/coins/${geckoId}/market_chart` +
    `?vs_currency=usd&days=${DAYS_BY_TF[tf]}`;
  const json = await coingeckoJson<{ prices?: [number, number][] }>(url);
  const prices: number[] = Array.isArray(json?.prices)
    ? json.prices.map((p: [number, number]) => p[1]).filter((n: number) => Number.isFinite(n))
    : [];
  chartCache.set(key, { prices, fetchedAt: Date.now() });
  return prices;
}

async function fetchStats(geckoId: string): Promise<TokenStats> {
  const cached = statsCache.get(geckoId);
  if (cached && Date.now() - cached.fetchedAt < STATS_TTL) return cached.stats;

  const url =
    `/coins/${geckoId}` +
    `?localization=false&tickers=false&market_data=true` +
    `&community_data=false&developer_data=false&sparkline=false`;
  const json = await coingeckoJson<{
    market_cap_rank?: number;
    market_data?: Record<string, any>;
    description?: { en?: string };
  }>(url);
  const md = json?.market_data ?? {};

  const stats: TokenStats = {
    marketCapRank: json?.market_cap_rank ?? md?.market_cap_rank ?? null,
    marketCap: md?.market_cap?.usd ?? null,
    totalVolume: md?.total_volume?.usd ?? null,
    circulatingSupply: md?.circulating_supply ?? null,
    maxSupply: md?.max_supply ?? null,
    ath: md?.ath?.usd ?? null,
    athDate: md?.ath_date?.usd ?? null,
    high24h: md?.high_24h?.usd ?? null,
    low24h: md?.low_24h?.usd ?? null,
    low52w: md?.low_52w?.usd ?? md?.atl?.usd ?? null,
    high52w: md?.high_52w?.usd ?? null,
    description: typeof json?.description?.en === 'string' && json.description.en.trim()
      ? json.description.en
      : null,
  };
  statsCache.set(geckoId, { stats, fetchedAt: Date.now() });
  return stats;
}

async function fetchStatsWithAbout(
  geckoId: string,
  aboutGeckoId?: string | null,
): Promise<TokenStats> {
  const stats = await fetchStats(geckoId);
  if (stats.description || !aboutGeckoId || aboutGeckoId === geckoId) return stats;

  const about = await fetchStats(aboutGeckoId);
  return about.description ? { ...stats, description: about.description } : stats;
}

export function useTokenDetail(
  geckoId: string | null,
  timeframe: Timeframe,
  aboutGeckoId?: string | null,
) {
  const [prices, setPrices] = useState<number[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [stats, setStats] = useState<TokenStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reqId = useRef(0);

  // Chart — refetch when timeframe or token changes.
  useEffect(() => {
    if (!geckoId) { setPrices([]); return; }
    const id = ++reqId.current;
    setChartLoading(true);
    setError(null);
    fetchChart(geckoId, timeframe)
      .then((p) => { if (id === reqId.current) setPrices(p); })
      .catch((e) => { if (id === reqId.current) setError(e?.message ?? i18n.t('crypto.chartFailed')); })
      .finally(() => { if (id === reqId.current) setChartLoading(false); });
  }, [geckoId, timeframe]);

  // Stats — fetch once per token.
  useEffect(() => {
    if (!geckoId) { setStats(null); return; }
    let active = true;
    setStatsLoading(true);
    fetchStatsWithAbout(geckoId, aboutGeckoId)
      .then((s) => { if (active) setStats(s); })
      .catch(() => { /* stats are best-effort */ })
      .finally(() => { if (active) setStatsLoading(false); });
    return () => { active = false; };
  }, [geckoId, aboutGeckoId]);

  const reset = useCallback(() => {
    setPrices([]);
    setStats(null);
    setError(null);
  }, []);

  return { prices, chartLoading, stats, statsLoading, error, reset };
}
