/**
 * Direct Gnosis Pay integration config.
 * Env source: src/config/env.ts
 */

import { env } from '../../../config/env';

export const GP_DIRECT_ENABLED = env.gpDirectEnabled;

export const GP_API_BASE_URL = env.gpApiBaseUrl.replace(/\/+$/, '');

export const GP_SIWE_DOMAIN = env.gpSiweDomain || 'localhost';

const GP_SIWE_URI_FALLBACK = 'https://app.gnosispay.com';

function isLoopbackUrl(url: string): boolean {
  return /:\/\/(localhost|127\.0\.0\.1)(?::\d+)?(?:[/?#]|$)/i.test(url);
}

export const GP_SIWE_URI = (() => {
  const candidate = env.gpSiweUri || `https://${GP_SIWE_DOMAIN}`;
  return isLoopbackUrl(candidate) ? GP_SIWE_URI_FALLBACK : candidate;
})();

export const GP_PARTNER_ID = env.gpPartnerId;

export const GP_CHAIN_ID = 100 as const;

export const GP_SIWE_STATEMENT = 'Sign in with Ethereum to Gnosis Pay.';

export const GP_JWT_TTL_SECONDS = (() => {
  const raw = Number(env.gpJwtTtlSeconds);
  const ttl = Number.isFinite(raw) && raw > 0 ? raw : 12 * 60 * 60;
  return Math.min(Math.max(ttl, 60 * 60), 24 * 60 * 60);
})();

export const GP_JWT_STORE_KEY = 'kura_gp_jwt_v1' as const;
