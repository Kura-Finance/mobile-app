import { coingeckoFetch } from '../coingecko/client';

const YAHOO_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const STABLECOIN_IDS = new Set([
  'tether',
  'usd-coin',
  'dai',
  'first-digital-usd',
  'ethena-usde',
  'usds',
  'paypal-usd',
  'ripple-usd',
]);

export type UsMarketStatus = 'open' | 'closed' | 'pre' | 'post';

export interface MarketIndicesSnapshot {
  usMarketStatus: UsMarketStatus;
  sp500Price: number | null;
  sp500ChangePct: number | null;
  sp500Sparkline: number[];
  altcoinSeasonIndex: number | null;
  fearGreedValue: number | null;
  fearGreedLabel: string | null;
  fetchedAt: number;
}

export function getUsMarketStatus(now = new Date()): UsMarketStatus {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const mins = hour * 60 + minute;

  if (weekday === 'Sat' || weekday === 'Sun') return 'closed';
  if (mins >= 570 && mins < 960) return 'open';
  if (mins >= 240 && mins < 570) return 'pre';
  if (mins >= 960 && mins < 1200) return 'post';
  return 'closed';
}

async function fetchSp500Quote(): Promise<{
  price: number | null;
  changePct: number | null;
  sparkline: number[];
}> {
  const url =
    'https://query2.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1d&interval=5m';
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': YAHOO_UA },
  });
  if (!res.ok) throw new Error(`S&P ${res.status}`);

  const json = await res.json();
  const result = (json as {
    chart?: { result?: Array<{ meta?: Record<string, number>; indicators?: { quote?: Array<{ close?: Array<number | null> }> } }> };
  })?.chart?.result?.[0];
  const meta = result?.meta ?? {};
  const price = meta.regularMarketPrice ?? null;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const changePct =
    price != null && prev != null && prev > 0 ? ((price - prev) / prev) * 100 : null;
  const closes = result?.indicators?.quote?.[0]?.close ?? [];
  const sparkline = closes.filter((n): n is number => n != null && Number.isFinite(n));

  return { price, changePct, sparkline };
}

async function fetchFearGreedIndex(): Promise<{ value: number | null; label: string | null }> {
  const res = await fetch('https://api.alternative.me/fng/?limit=1');
  if (!res.ok) throw new Error(`F&G ${res.status}`);

  const json = await res.json() as {
    data?: Array<{ value?: string; value_classification?: string }>;
  };
  const row = json.data?.[0];
  const value = row?.value != null ? Number(row.value) : null;
  return {
    value: Number.isFinite(value) ? value : null,
    label: row?.value_classification ?? null,
  };
}

const ALT_SEASON_CACHE_TTL_MS = 60 * 60_000; // 30d metric — refresh hourly

let altSeasonCache: { value: number | null; fetchedAt: number } | null = null;

async function fetchAltcoinSeasonIndex(): Promise<number | null> {
  const now = Date.now();
  if (altSeasonCache && now - altSeasonCache.fetchedAt < ALT_SEASON_CACHE_TTL_MS) {
    return altSeasonCache.value;
  }

  try {
    const url =
      '/coins/markets' +
      '?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&price_change_percentage=30d';
    const res = await coingeckoFetch(url);
    if (!res.ok) throw new Error(`Alt season ${res.status}`);

    const rows = await res.json() as Array<{
      id: string;
      price_change_percentage_30d_in_currency?: number;
    }>;

    const btc = rows.find((row) => row.id === 'bitcoin');
    const btcChange = btc?.price_change_percentage_30d_in_currency;
    if (btcChange == null || !Number.isFinite(btcChange)) {
      altSeasonCache = { value: null, fetchedAt: now };
      return null;
    }

    const alts = rows.filter((row) => row.id !== 'bitcoin' && !STABLECOIN_IDS.has(row.id));
    const outperform = alts.filter((row) => {
      const change = row.price_change_percentage_30d_in_currency;
      return change != null && Number.isFinite(change) && change > btcChange;
    }).length;

    const sampleSize = Math.min(50, alts.length);
    if (sampleSize === 0) {
      altSeasonCache = { value: null, fetchedAt: now };
      return null;
    }

    const value = Math.round((outperform / sampleSize) * 100);
    altSeasonCache = { value, fetchedAt: now };
    return value;
  } catch {
    if (altSeasonCache) return altSeasonCache.value;
    return null;
  }
}

export async function fetchMarketIndices(): Promise<MarketIndicesSnapshot> {
  const usMarketStatus = getUsMarketStatus();

  const [sp500, fearGreed, altcoinSeasonIndex] = await Promise.all([
    fetchSp500Quote().catch(() => ({ price: null, changePct: null, sparkline: [] as number[] })),
    fetchFearGreedIndex().catch(() => ({ value: null, label: null })),
    fetchAltcoinSeasonIndex().catch(() => null),
  ]);

  return {
    usMarketStatus,
    sp500Price: sp500.price,
    sp500ChangePct: sp500.changePct,
    sp500Sparkline: sp500.sparkline,
    altcoinSeasonIndex,
    fearGreedValue: fearGreed.value,
    fearGreedLabel: fearGreed.label,
    fetchedAt: Date.now(),
  };
}
