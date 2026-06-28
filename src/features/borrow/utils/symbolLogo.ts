import { BLUE_CHIPS, USDT_DISPLAY, type BluechipToken } from '../../crypto/config/blueChips';

/** logo.dev crypto slug overrides for Morpho asset symbols. */
const LOGO_SYMBOL_ALIASES: Record<string, string> = {
  ETH: 'eth',
  WETH: 'eth',
  cbBTC: 'btc',
  cbDOGE: 'doge',
  SOL: 'sol',
  cbXRP: 'xrp',
  XRP: 'xrp',
  cbETH: 'eth',
  wstETH: 'wsteth',
  weETH: 'eth',
  rETH: 'reth',
  USDe: 'usde',
  USDC: 'usdc',
  EURC: 'euroc',
  XSGD: 'xsgd',
  AUDD: 'audd',
  BRZ: 'brz',
  MXNe: 'mxne',
  DAI: 'dai',
  USDT: 'usdt',
};

export function resolveBluechipToken(symbol: string): BluechipToken | null {
  const key = symbol.trim().toUpperCase();
  const direct = BLUE_CHIPS.find((t) => t.symbol.toUpperCase() === key);
  if (direct) return direct;
  if (key === 'ETH') return BLUE_CHIPS.find((t) => t.symbol === 'WETH') ?? null;
  if (key === 'USDT') return USDT_DISPLAY;
  if (key === 'CBXRP') return BLUE_CHIPS.find((t) => t.symbol === 'XRP') ?? null;
  return null;
}

export function logoSymbolForAsset(symbol: string): string {
  const trimmed = symbol.trim();
  if (!trimmed) return '';
  const alias = LOGO_SYMBOL_ALIASES[trimmed] ?? LOGO_SYMBOL_ALIASES[trimmed.toUpperCase()];
  if (alias) return alias;
  const token = resolveBluechipToken(trimmed);
  if (token?.logoSymbol) return token.logoSymbol;
  if (token) return token.symbol.toLowerCase();
  return trimmed.toLowerCase();
}

/** Compact single-glyph fallback when no remote logo is available. */
export function symbolFallbackGlyph(symbol: string): string {
  const key = symbol.trim().toUpperCase();
  if (key === 'EURC') return '€';
  if (key === 'USDC' || key === 'USDT' || key === 'DAI' || key === 'USDe' || key === 'USDY') return '$';
  if (key.length <= 3) return key;
  if (key.startsWith('CB') && key.length > 2) return key.slice(2, 4);
  return key.slice(0, 2);
}
