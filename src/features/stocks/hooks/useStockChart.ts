/**
 * useStockChart
 *
 * Fetches underlying US equity OHLC history for StockDetail charts.
 * Dinari dShare CoinGecko listings have almost no intraday volume, so we
 * chart the backed ticker (AAPL, TSLA, …) via Yahoo Finance v8 chart API.
 */
import { useEffect, useRef, useState } from 'react';
import i18n from '../../../shared/locales/i18n';
import type { Timeframe } from '../../crypto/hooks/useTokenDetail';
import { fetchYahooStats, type StockChartStats } from '../utils/yahooStockStats';

export type { StockChartStats } from '../utils/yahooStockStats';

interface PriceCacheEntry {
  prices: number[];
  fetchedAt: number;
}

const priceCache = new Map<string, PriceCacheEntry>();
const CHART_TTL = 60_000;

const YAHOO_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const YAHOO_PARAMS: Record<Timeframe, { range: string; interval: string }> = {
  '24H': { range: '1d', interval: '5m' },
  '1W': { range: '5d', interval: '15m' },
  '1M': { range: '1mo', interval: '1d' },
  '6M': { range: '6mo', interval: '1d' },
  '1Y': { range: '1y', interval: '1d' },
};

function parseYahooCloses(json: unknown): number[] {
  const result = (json as any)?.chart?.result?.[0];
  const closes: Array<number | null> = result?.indicators?.quote?.[0]?.close ?? [];
  return closes.filter((n): n is number => n != null && Number.isFinite(n));
}

async function fetchYahooChart(symbol: string, tf: Timeframe): Promise<number[]> {
  const { range, interval } = YAHOO_PARAMS[tf];
  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=${range}&interval=${interval}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': YAHOO_UA },
  });
  if (!res.ok) throw new Error(`Chart ${res.status}`);
  const json = await res.json();
  return parseYahooCloses(json);
}

export function useStockChart(symbol: string | null, timeframe: Timeframe, active: boolean) {
  const [prices, setPrices] = useState<number[]>([]);
  const [stats, setStats] = useState<StockChartStats | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!active || !symbol) {
      setPrices([]);
      return;
    }
    const key = `${symbol}:${timeframe}`;
    const cached = priceCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CHART_TTL) {
      setPrices(cached.prices);
      return;
    }

    const id = ++reqId.current;
    setChartLoading(true);
    setError(null);
    fetchYahooChart(symbol, timeframe)
      .then((p) => {
        if (id !== reqId.current) return;
        priceCache.set(key, { prices: p, fetchedAt: Date.now() });
        setPrices(p);
      })
      .catch((e) => {
        if (id !== reqId.current) return;
        setError(e?.message ?? i18n.t('crypto.chartFailed'));
        setPrices([]);
      })
      .finally(() => {
        if (id === reqId.current) setChartLoading(false);
      });
  }, [symbol, timeframe, active]);

  useEffect(() => {
    if (!active || !symbol) {
      setStats(null);
      return;
    }

    let alive = true;
    fetchYahooStats(symbol)
      .then((s) => {
        if (!alive) return;
        setStats(s);
      })
      .catch(() => { /* stats are best-effort */ });
    return () => { alive = false; };
  }, [symbol, active]);

  return { prices, stats, chartLoading, error };
}
