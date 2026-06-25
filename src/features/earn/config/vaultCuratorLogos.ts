/**
 * Curator brand fallbacks when Morpho metadata images fail (e.g. SVG load errors).
 */
import { cryptoLogoUrl, domainLogoUrl, tickerLogoUrl } from '../../../config/logodev';

/** First-word curator key → company domain for logo.dev. */
const CURATOR_DOMAINS: Record<string, string> = {
  gauntlet: 'gauntlet.xyz',
  steakhouse: 'steakhouse.financial',
  pangolins: 'pangolins.io',
  moonwell: 'moonwell.fi',
  spark: 'spark.fi',
  metronome: 'metronome.io',
  re7: 're7labs.xyz',
  clearstar: 'clearstar.xyz',
  idle: 'idle.finance',
};

/** logo.dev crypto slug overrides (see blueChips logoSymbol). */
const ASSET_LOGO_SYMBOLS: Record<string, string> = {
  USDC: 'usdc',
  EURC: 'euroc',
  DAI: 'dai',
};

function curatorKeyFromName(name: string): string | null {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase();
  return first && CURATOR_DOMAINS[first] ? first : null;
}

export function isSvgLogoUrl(url: string): boolean {
  return /\.svg(\?|#|$)/i.test(url);
}

export function isRasterLogoUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(url);
}

/**
 * External SVGs with embedded `<style>` blocks fail in react-native-svg SvgUri
 * (paths render with default black fill). Morpho token logos use this pattern.
 */
export function isReactNativeSafeSvgUrl(url: string): boolean {
  if (!isSvgLogoUrl(url)) return false;
  if (/cdn\.morpho\.org\/assets\/logos\//i.test(url)) return false;
  return true;
}

/** Morpho metadata when safe; then asset + curator fallbacks. */
export function resolveVaultLogoCandidates(
  name: string,
  imageUrl: string | null | undefined,
  assetSymbol: string,
  size: number,
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const push = (url: string | null | undefined) => {
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  };

  if (imageUrl && (!isSvgLogoUrl(imageUrl) || isReactNativeSafeSvgUrl(imageUrl))) {
    push(imageUrl);
  }

  const sym = assetSymbol.toUpperCase();
  const logoSym = ASSET_LOGO_SYMBOLS[sym] ?? sym.toLowerCase();
  push(cryptoLogoUrl(logoSym, size));
  push(tickerLogoUrl(sym, size));

  const key = curatorKeyFromName(name);
  if (key) push(domainLogoUrl(CURATOR_DOMAINS[key], size));

  return urls;
}

export function vaultFallbackGlyph(name: string, assetSymbol: string): string {
  const key = curatorKeyFromName(name);
  if (key) return key.charAt(0).toUpperCase();
  return (assetSymbol || name).charAt(0).toUpperCase();
}
