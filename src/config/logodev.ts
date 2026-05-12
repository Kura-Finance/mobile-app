import type { ImageSourcePropType } from 'react-native';

import { brand } from './branding';
import { env } from './env';

/** logo.dev publishable key (pk_…). Empty when unset — callers use glyph fallbacks. */
export const LOGODEV_TOKEN = env.logodevToken;

/** Referer sent with img.logo.dev requests (required when domain restrictions are enabled). */
export const LOGODEV_REFERER = `${brand.homepage}/`;

function appendToken(url: string): string {
  if (url.includes('token=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(LOGODEV_TOKEN)}`;
}

/**
 * Ensure a logo.dev CDN URL includes the publishable token.
 * Non-logo.dev URLs pass through unchanged.
 */
export function withLogoDevAuth(raw: string | undefined | null): string | null {
  if (!raw || !raw.startsWith('http')) return null;
  if (!raw.includes('img.logo.dev/')) return raw;

  const pathMatch = raw.match(/img\.logo\.dev\/([^?#]+)/);
  if (!pathMatch) return raw;

  if (LOGODEV_TOKEN) return appendToken(raw);

  // No token — domain-style paths can fall back to Clearbit (exchange list icons).
  const path = pathMatch[1];
  if (!path.startsWith('ticker/') && !path.startsWith('crypto/') && !path.startsWith('isin/') && !path.startsWith('name/')) {
    return `https://logo.clearbit.com/${path}`;
  }
  return null;
}

/** Image source for remote logos; adds Referer for img.logo.dev (mobile has none by default). */
export function logoDevImageSource(raw: string | null | undefined): ImageSourcePropType | null {
  const url = withLogoDevAuth(raw);
  if (!url) return null;
  if (url.includes('img.logo.dev/')) {
    return { uri: url, headers: { Referer: LOGODEV_REFERER } };
  }
  return { uri: url };
}

export function tickerLogoUrl(symbol: string, size = 64): string | null {
  if (!LOGODEV_TOKEN || !symbol) return null;
  return (
    `https://img.logo.dev/ticker/${encodeURIComponent(symbol.toUpperCase())}` +
    `?token=${LOGODEV_TOKEN}&size=${size}&format=png`
  );
}

export function cryptoLogoUrl(symbol: string, size = 128): string | null {
  if (!LOGODEV_TOKEN || !symbol) return null;
  return (
    `https://img.logo.dev/crypto/${encodeURIComponent(symbol.toLowerCase())}` +
    `?token=${LOGODEV_TOKEN}&size=${size}&format=png`
  );
}

/** Company logo by domain — https://www.logo.dev/docs/logo-images/get */
export function domainLogoUrl(domain: string, size = 64): string | null {
  if (!LOGODEV_TOKEN || !domain) return null;
  const host = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return (
    `https://img.logo.dev/${encodeURIComponent(host)}` +
    `?token=${LOGODEV_TOKEN}&size=${size}&format=png`
  );
}

/** logo.dev lookup order for Gnosis Pay branding. */
export const GNOSIS_LOGO_DOMAINS = ['gnosispay.com', 'gnosis.io'] as const;

/** logo.dev lookup for supported send/bridge chains (domain first, crypto fallback). */
export const CHAIN_LOGO_LOOKUP: Record<
  string,
  { domains: readonly string[]; crypto?: string }
> = {
  BASE: { domains: ['base.org', 'coinbase.com'], crypto: 'base' },
  ETH:  { domains: ['ethereum.org'], crypto: 'eth' },
  OP:   { domains: ['optimism.io'], crypto: 'op' },
  POL:  { domains: ['polygon.technology'], crypto: 'matic' },
  ARB:  { domains: ['arbitrum.io'], crypto: 'arb' },
  GNO:  { domains: ['gnosis.io'], crypto: 'gno' },
};

/** Ordered logo.dev URLs to try for a chain key (2× size for retina). */
export function chainLogoUrls(chainKey: string, size = 64): string[] {
  if (!LOGODEV_TOKEN) return [];
  const lookup = CHAIN_LOGO_LOOKUP[chainKey];
  if (!lookup) return [];
  const urls: string[] = [];
  for (const domain of lookup.domains) {
    const url = domainLogoUrl(domain, size);
    if (url) urls.push(url);
  }
  if (lookup.crypto) {
    const url = cryptoLogoUrl(lookup.crypto, size);
    if (url) urls.push(url);
  }
  return urls;
}
