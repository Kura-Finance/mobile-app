/**
 * Shared Li.Fi configuration for the bridge + swap clients.
 * Env vars: src/config/env.ts — see .env.example.
 */

import { env } from '../../../config/env';

export const LIFI_API = 'https://li.quest/v1';

export const LIFI_INTEGRATOR = env.lifiIntegrator;

export const LIFI_FEE = env.lifiFee;

const LIFI_API_KEY = env.lifiApiKey;

export function lifiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (LIFI_API_KEY) headers['x-lifi-api-key'] = LIFI_API_KEY;
  return headers;
}

export function applyIntegratorParams(qs: URLSearchParams): void {
  if (!LIFI_INTEGRATOR) return;
  qs.set('integrator', LIFI_INTEGRATOR);
  if (LIFI_FEE) qs.set('fee', LIFI_FEE);
}
