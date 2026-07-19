/**
 * Host allowlist helpers for in-app WebViews (Dinari KYC, legal pages, etc.).
 */

function normalizeHost(host: string): string {
  return host.trim().toLowerCase().replace(/\.$/, '');
}

export function hostFromUrl(url: string): string | null {
  try {
    return normalizeHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

/** Hostnames (exact or parent suffix) permitted for WebView navigation. */
export function isAllowedWebViewHost(url: string, allowedHosts: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol === 'about:') return true;
  if (parsed.protocol !== 'https:') return false;

  const host = normalizeHost(parsed.hostname);
  return allowedHosts.some((allowed) => {
    const normalized = normalizeHost(allowed);
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

export function shouldAllowWebViewNavigation(
  url: string,
  allowedHosts: readonly string[],
): boolean {
  return isAllowedWebViewHost(url, allowedHosts);
}

export function allowedHostsFromSeedUrl(seedUrl: string): string[] {
  const host = hostFromUrl(seedUrl);
  return host ? [host] : [];
}
