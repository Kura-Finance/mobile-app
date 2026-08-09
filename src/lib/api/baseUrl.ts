import { getResolvedApiBaseUrl } from '../../config/env';

export function getApiBaseUrl(): string {
  return getResolvedApiBaseUrl();
}

export function isAbsoluteUrl(path: string): boolean {
  return /^https?:\/\//i.test(path);
}

export function resolveRequestUrl(path: string): string {
  if (isAbsoluteUrl(path)) return path;
  const base = getApiBaseUrl();
  if (!base) {
    throw new Error(
      'App backend URL is not configured. Set EXPO_PUBLIC_API_BASE_URL in .env ' +
        '(leave empty for wallet-only; see docs/official-services.md).',
    );
  }
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
