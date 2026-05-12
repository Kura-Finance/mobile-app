import { isWalletConnectUri } from './constants';

/**
 * True when the URI is a full WalletConnect **pairing** URI (symKey + relay).
 * Incomplete URIs (topic-only) are used for session-request redirects and must
 * not trigger `pair()`.
 */
export function isWalletConnectPairingUri(uri: string): boolean {
  const trimmed = uri.trim();
  if (!isWalletConnectUri(trimmed)) return false;
  return trimmed.includes('symKey=') && trimmed.includes('relay-protocol=');
}

function decodeUriCandidate(value: string): string | null {
  const trimmed = value.trim();
  if (isWalletConnectPairingUri(trimmed)) return trimmed;

  try {
    const decoded = decodeURIComponent(trimmed);
    if (isWalletConnectPairingUri(decoded)) return decoded;
  } catch {
    // ignore malformed encoding
  }

  return null;
}

function parseQueryParams(url: string): Record<string, string> {
  const queryStart = url.indexOf('?');
  if (queryStart === -1) return {};

  const hashStart = url.indexOf('#', queryStart);
  const query = url.slice(queryStart + 1, hashStart === -1 ? undefined : hashStart);
  const params: Record<string, string> = {};

  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    try {
      params[decodeURIComponent(key)] = decodeURIComponent(value);
    } catch {
      params[key] = value;
    }
  }

  return params;
}

function extractUriQueryValue(url: string): string | null {
  const match = url.match(/[?&#]uri=(.+)$/i);
  if (!match?.[1]) return null;

  const withoutHash = match[1].split('#')[0];
  return decodeUriCandidate(withoutHash);
}

/**
 * Extract a WalletConnect pairing URI from an inbound app deep / universal link.
 *
 * Supported shapes:
 *   kura://wc?uri=wc:...@2?symKey=...&relay-protocol=irn
 *   kura:///wc?uri=wc:...
 *   kura://?uri=wc:...
 *   https://kura-finance.com/dashboard/wc?uri=wc:...
 */
export function parseWalletConnectDeepLink(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (isWalletConnectPairingUri(trimmed)) return trimmed;

  const queryParams = parseQueryParams(trimmed);
  if (queryParams.uri) {
    const fromQuery = decodeUriCandidate(queryParams.uri);
    if (fromQuery) return fromQuery;
  }

  const fromUriParam = extractUriQueryValue(trimmed);
  if (fromUriParam) return fromUriParam;

  const match = trimmed.match(/[?&#]uri=([^&#]+)/i);
  if (match?.[1]) {
    const decoded = decodeUriCandidate(match[1]);
    if (decoded) return decoded;
  }

  const wcMatch = trimmed.match(/(wc:[^&#\s]+)/);
  if (wcMatch?.[1]) {
    const decoded = decodeUriCandidate(wcMatch[1]);
    if (decoded) return decoded;
  }

  return null;
}
