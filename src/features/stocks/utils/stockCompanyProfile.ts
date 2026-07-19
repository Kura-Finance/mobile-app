/**
 * Company / fund profile for stock About — multi-source (Wikipedia, chart meta, CoinGecko).
 * Yahoo quoteSummary requires auth crumbs and is unreliable from mobile clients.
 */

export interface StockCompanyProfile {
  description: string | null;
  sector: string | null;
  industry: string | null;
  exchange: string | null;
  website: string | null;
  employees: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
}

const YAHOO_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const profileCache = new Map<string, { profile: StockCompanyProfile | null; fetchedAt: number }>();
const PROFILE_TTL = 24 * 60 * 60 * 1000;

interface WikipediaSummary {
  title?: string;
  description?: string;
  extract?: string;
}

interface ChartMeta {
  longName: string | null;
  exchange: string | null;
}

function cacheKey(symbol: string, name: string): string {
  return `${symbol.toUpperCase()}:${name.trim().toLowerCase()}`;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function parseHeadquartersFromExtract(extract: string | null | undefined): string | null {
  if (!extract) return null;
  const located = extract.match(/\bheadquartered in\s+(.+)/i);
  if (!located?.[1]) return null;

  const remainder = located[1];
  const clauseEnd = remainder.match(
    /^(.+?)(?=,\s+(?:in\s+(?:the\s+)?[A-Z][A-Za-z]+|with\b|and\s+(?:makes|operates|has|is|was)\b)|\.\s)/,
  );
  let hq = (clauseEnd?.[1] ?? remainder.split('.')[0] ?? '').trim().replace(/\.$/, '');
  if (!hq) return null;

  if (hq.length > 50) {
    const city = hq.match(/\bin ([A-Z][A-Za-z .]+ City)\s*$/);
    if (city?.[1]) return city[1].trim();
    return null;
  }

  return hq;
}

export function parseWikipediaSummary(json: unknown): { tagline: string | null; extract: string | null } {
  const summary = json as WikipediaSummary;
  return {
    tagline: readString(summary.description),
    extract: readString(summary.extract),
  };
}

export function parseChartMeta(json: unknown): ChartMeta {
  const meta = (json as { chart?: { result?: { meta?: Record<string, unknown> }[] } })
    ?.chart?.result?.[0]?.meta ?? {};
  return {
    longName: readString(meta.longName) ?? readString(meta.shortName),
    exchange: readString(meta.fullExchangeName) ?? readString(meta.exchangeName),
  };
}

function splitHeadquarters(raw: string | null): Pick<StockCompanyProfile, 'city' | 'state' | 'country'> {
  if (!raw) return { city: null, state: null, country: null };
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return { city: null, state: null, country: null };
  if (parts.length === 1) return { city: parts[0], state: null, country: null };
  if (parts.length === 2) return { city: parts[0], state: parts[1], country: null };
  return {
    city: parts[0],
    state: parts[1],
    country: parts.slice(2).join(', '),
  };
}

async function resolveWikipediaTitle(name: string, symbol: string): Promise<string | null> {
  const queries = [name.trim(), `${name.trim()} company`, symbol.toUpperCase()].filter(Boolean);
  for (const query of queries) {
    const url =
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}` +
      '&limit=1&namespace=0&format=json&origin=*';
    const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': YAHOO_UA } });
    if (!res.ok) continue;
    const json = await res.json() as [string, string[]];
    const title = json[1]?.[0];
    if (title) return title;
  }
  return null;
}

async function fetchWikipediaProfile(name: string, symbol: string): Promise<{
  tagline: string | null;
  extract: string | null;
  headquarters: string | null;
} | null> {
  const title = await resolveWikipediaTitle(name, symbol);
  if (!title) return null;

  const slug = encodeURIComponent(title.replace(/ /g, '_'));
  const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`, {
    headers: { Accept: 'application/json', 'User-Agent': YAHOO_UA },
  });
  if (!res.ok) return null;

  const parsed = parseWikipediaSummary(await res.json());
  if (!parsed.extract && !parsed.tagline) return null;

  return {
    ...parsed,
    headquarters: parseHeadquartersFromExtract(parsed.extract),
  };
}

async function fetchChartMeta(symbol: string): Promise<ChartMeta | null> {
  const url =
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}` +
    '?range=1d&interval=1d';
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': YAHOO_UA },
  });
  if (!res.ok) return null;
  const meta = parseChartMeta(await res.json());
  if (!meta.longName && !meta.exchange) return null;
  return meta;
}

async function fetchCoinGeckoDescription(geckoId: string): Promise<string | null> {
  const { coingeckoJson } = await import('../../../lib/api/coingecko/client');
  const json = await coingeckoJson<{ description?: { en?: string } }>(
    `/coins/${geckoId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=false`,
  );
  const desc = json?.description?.en?.trim();
  return desc || null;
}

export function formatStockHeadquarters(profile: Pick<StockCompanyProfile, 'city' | 'state' | 'country'>): string | null {
  const parts = [profile.city, profile.state, profile.country].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(', ') : null;
}

export function formatStockWebsiteLabel(url: string): string {
  try {
    const host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
    return host.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export async function fetchStockCompanyProfile(
  symbol: string,
  name: string,
  geckoId?: string | null,
): Promise<StockCompanyProfile | null> {
  const key = cacheKey(symbol, name);
  const cached = profileCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < PROFILE_TTL) {
    return cached.profile;
  }

  const [wiki, chartMeta, geckoDescription] = await Promise.all([
    fetchWikipediaProfile(name, symbol).catch(() => null),
    fetchChartMeta(symbol).catch(() => null),
    geckoId ? fetchCoinGeckoDescription(geckoId).catch(() => null) : Promise.resolve(null),
  ]);

  const description = wiki?.extract ?? geckoDescription ?? null;
  const hqParts = splitHeadquarters(wiki?.headquarters ?? null);

  const profile: StockCompanyProfile | null =
    description
    || wiki?.tagline
    || chartMeta?.exchange
    || hqParts.city
      ? {
          description,
          sector: null,
          industry: wiki?.tagline ?? null,
          exchange: chartMeta?.exchange ?? null,
          website: null,
          employees: null,
          ...hqParts,
        }
      : null;

  profileCache.set(key, { profile, fetchedAt: Date.now() });
  return profile;
}
