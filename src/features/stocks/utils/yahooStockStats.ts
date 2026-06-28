/**
 * Yahoo Finance v8 chart API — shared by stock list 24h change and detail charts.
 */

export interface StockChartStats {
  high24h: number | null;
  low24h: number | null;
  totalVolume: number | null;
  change24hPercent: number | null;
  /** Yahoo regular market price used to scale stats to Dinari quote. */
  referencePrice: number | null;
}

const YAHOO_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const statsCache = new Map<string, { stats: StockChartStats; fetchedAt: number }>();
const STATS_TTL = 120_000;

function parseYahooStats(json: unknown): StockChartStats {
  const result = (json as any)?.chart?.result?.[0];
  const meta = result?.meta ?? {};
  const quote = result?.indicators?.quote?.[0] ?? {};
  const highs: Array<number | null> = quote.high ?? [];
  const lows: Array<number | null> = quote.low ?? [];
  const volumes: Array<number | null> = quote.volume ?? [];

  const validHighs = highs.filter((n): n is number => n != null && Number.isFinite(n));
  const validLows = lows.filter((n): n is number => n != null && Number.isFinite(n));
  const totalVolume = volumes.reduce<number>((sum, v) => sum + (v ?? 0), 0);

  const price = meta.regularMarketPrice ?? null;
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const change24hPercent =
    price != null && prev != null && prev > 0 ? ((price - prev) / prev) * 100 : null;

  return {
    high24h: validHighs.length ? Math.max(...validHighs) : null,
    low24h: validLows.length ? Math.min(...validLows) : null,
    totalVolume: totalVolume > 0 ? totalVolume : null,
    change24hPercent,
    referencePrice: price,
  };
}

export async function fetchYahooStats(symbol: string): Promise<StockChartStats> {
  const key = symbol.toUpperCase();
  const cached = statsCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < STATS_TTL) {
    return cached.stats;
  }

  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(key)}` +
    '?range=1d&interval=5m';
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': YAHOO_UA },
  });
  if (!res.ok) throw new Error(`Stats ${res.status}`);
  const json = await res.json();
  const stats = parseYahooStats(json);
  statsCache.set(key, { stats, fetchedAt: Date.now() });
  return stats;
}

export interface YahooMarketSnapshot {
  price: number | null;
  change24h: number | null;
}

export async function fetchYahooMarketMap(
  symbols: string[],
): Promise<Map<string, YahooMarketSnapshot>> {
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()).filter(Boolean))];
  const result = new Map<string, YahooMarketSnapshot>();

  await Promise.all(
    unique.map(async (symbol) => {
      try {
        const stats = await fetchYahooStats(symbol);
        result.set(symbol, {
          price: stats.referencePrice,
          change24h: stats.change24hPercent,
        });
      } catch {
        result.set(symbol, { price: null, change24h: null });
      }
    }),
  );

  return result;
}
