/**
 * Display metadata for Dinari dShares (tokenized US stocks).
 *
 * The tradeable universe comes from the Dinari `listStocks` API; this map only
 * supplies brand colours and a default symbol list for a polished UI. Unknown
 * symbols fall back to a neutral colour and their ticker initials.
 */

export interface StockMeta {
  color: string;
  /** CoinGecko coin id for chart / stats enrichment (null = no listing). */
  geckoId?: string;
}

/** Curated tickers shown in the portfolio watchlist section (priced on load). */
export const DEFAULT_STOCK_SYMBOLS = [
  'AAPL',
  'TSLA',
  'NVDA',
  'MSFT',
  'GOOGL',
  'AMZN',
  'META',
  'NFLX',
  'AMD',
  'COIN',
  'SPY',
  'QQQ',
];

/** Verified against CoinGecko `/coins/list` (Dinari dShare listings). */
const META_BY_SYMBOL: Record<string, StockMeta> = {
  AAPL: { color: '#A2AAAD', geckoId: 'dinari-aapl-dshares' },
  TSLA: { color: '#E82127', geckoId: 'dinari-tsla-dshares' },
  NVDA: { color: '#76B900', geckoId: 'dinari-nvda-dshares' },
  MSFT: { color: '#00A4EF', geckoId: 'dinari-msft-dshares' },
  GOOGL: { color: '#4285F4', geckoId: 'dinari-googl-dshares' },
  AMZN: { color: '#FF9900', geckoId: 'dinari-amzn-dshares' },
  META: { color: '#0866FF', geckoId: 'dinari-meta-dshare' },
  NFLX: { color: '#E50914', geckoId: 'dinari-nflx-dshares' },
  AMD: { color: '#ED1C24', geckoId: 'dinari-amd' },
  COIN: { color: '#0052FF', geckoId: 'dinari-coin' },
  SPY: { color: '#6E44FF', geckoId: 'dinari-spy-dshares' },
  QQQ: { color: '#00C2A8' },
};

const FALLBACK_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#06B6D4'];

/** CoinGecko coin id for RWA chart/stats, or null when not listed. */
export function stockGeckoId(symbol: string): string | null {
  return META_BY_SYMBOL[symbol?.toUpperCase()]?.geckoId ?? null;
}

const DEFAULT_STOCK_SYMBOL_SET = new Set(DEFAULT_STOCK_SYMBOLS);

/** Whether a ticker is in the curated portfolio watchlist section. */
export function isFeaturedStockSymbol(symbol: string): boolean {
  return DEFAULT_STOCK_SYMBOL_SET.has(symbol?.toUpperCase());
}

export function stockColor(symbol: string): string {
  const meta = META_BY_SYMBOL[symbol?.toUpperCase()];
  if (meta) return meta.color;
  // Deterministic fallback colour from the symbol.
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length];
}

/** Two-letter glyph shown inside the logo circle (fallback when no logo). */
export function stockGlyph(symbol: string): string {
  return (symbol || '?').slice(0, 2).toUpperCase();
}

import { tickerLogoUrl } from '../../../config/logodev';

export function stockLogoUrl(symbol: string, size = 64): string | null {
  return tickerLogoUrl(symbol, size);
}
