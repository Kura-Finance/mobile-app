/**
 * Shared CoinGecko HTTP client — in-flight dedup, 429 backoff, optional API key.
 *
 * Free tier is ~10–30 req/min; multiple hooks (portfolio, token detail, market
 * strip) share this layer so concurrent identical GETs collapse to one request.
 */
import { env } from '../../../config/env';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

const inFlight = new Map<string, Promise<Response>>();

function coingeckoHeaders(extra?: HeadersInit): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (env.coingeckoApiKey) {
    headers['x-cg-demo-api-key'] = env.coingeckoApiKey;
  }
  if (extra) {
    if (extra instanceof Headers) {
      extra.forEach((v, k) => { headers[k] = v; });
    } else if (Array.isArray(extra)) {
      for (const [k, v] of extra) headers[k] = v;
    } else {
      Object.assign(headers, extra);
    }
  }
  return headers;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${COINGECKO_BASE}${path}`;
}

/** GET with shared in-flight dedup and exponential backoff on 429. */
export async function coingeckoFetch(
  pathOrUrl: string,
  init?: RequestInit,
  options?: { maxRetries?: number },
): Promise<Response> {
  const url = resolveUrl(pathOrUrl);
  const method = (init?.method ?? 'GET').toUpperCase();
  const dedupeKey = method === 'GET' ? url : `${method}:${url}`;

  const existing = inFlight.get(dedupeKey);
  if (existing) return existing;

  const maxRetries = options?.maxRetries ?? 3;

  const promise = (async (): Promise<Response> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const res = await fetch(url, {
        ...init,
        method,
        headers: coingeckoHeaders(init?.headers),
      });

      if (res.status === 429 && attempt < maxRetries) {
        const retryAfterSec = parseInt(res.headers.get('Retry-After') ?? '0', 10);
        const delayMs = retryAfterSec > 0
          ? retryAfterSec * 1000
          : Math.min(1000 * 2 ** (attempt - 1), 10_000);
        await sleep(delayMs);
        continue;
      }

      return res;
    }

    throw new Error('CoinGecko 429');
  })().finally(() => {
    inFlight.delete(dedupeKey);
  });

  inFlight.set(dedupeKey, promise);
  return promise;
}

export async function coingeckoJson<T>(
  pathOrUrl: string,
  init?: RequestInit,
): Promise<T> {
  const res = await coingeckoFetch(pathOrUrl, init);
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  return res.json() as Promise<T>;
}
