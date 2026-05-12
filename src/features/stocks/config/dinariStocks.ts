/**
 * Display metadata for Dinari dShares (tokenized US stocks).
 *
 * The tradeable universe comes from the Dinari `listStocks` API; this map only
 * supplies brand colours and a default symbol list for a polished UI. Unknown
 * symbols fall back to a neutral colour and their ticker initials.
 */

export interface StockMeta {
  color: string;
}

/** Curated set of popular tickers requested from Dinari by default. */
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

const META_BY_SYMBOL: Record<string, StockMeta> = {
  AAPL: { color: '#A2AAAD' },
  TSLA: { color: '#E82127' },
  NVDA: { color: '#76B900' },
  MSFT: { color: '#00A4EF' },
  GOOGL: { color: '#4285F4' },
  AMZN: { color: '#FF9900' },
  META: { color: '#0866FF' },
  NFLX: { color: '#E50914' },
  AMD: { color: '#ED1C24' },
  COIN: { color: '#0052FF' },
  SPY: { color: '#6E44FF' },
  QQQ: { color: '#00C2A8' },
};

const FALLBACK_COLORS = ['#8B5CF6', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#06B6D4'];

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
