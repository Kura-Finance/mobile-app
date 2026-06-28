/**
 * Shared Li.Fi configuration for the bridge + swap clients.
 * Env vars: src/config/env.ts — see .env.example.
 *
 * Integrator fees require:
 *  1. EXPO_PUBLIC_LIFI_INTEGRATOR + EXPO_PUBLIC_LIFI_FEE in .env before build
 *  2. Fee wallet configured at https://portal.li.fi/ for that integrator id
 * Fees on Base are forwarded to your wallet at tx execution (FeeForwarder).
 */

import { env } from '../../../config/env';
import Logger from '../../../shared/utils/Logger';

export const LIFI_API = 'https://li.quest/v1';

/** Default max price movement tolerance for Li.Fi quotes (0.01 = 1%). */
export const LIFI_DEFAULT_SLIPPAGE = 0.3;

export const LIFI_INTEGRATOR = env.lifiIntegrator;

export const LIFI_FEE = env.lifiFee;

const LIFI_API_KEY = env.lifiApiKey;

if (__DEV__) {
  if (LIFI_INTEGRATOR && !LIFI_FEE) {
    Logger.warn(
      'LiFi',
      'EXPO_PUBLIC_LIFI_INTEGRATOR is set but EXPO_PUBLIC_LIFI_FEE is empty — no integrator fee will be collected',
    );
  }
  if (!LIFI_INTEGRATOR && LIFI_FEE) {
    Logger.warn(
      'LiFi',
      'EXPO_PUBLIC_LIFI_FEE is set but EXPO_PUBLIC_LIFI_INTEGRATOR is empty — fee param is ignored',
    );
  }
  if (LIFI_INTEGRATOR && LIFI_FEE) {
    Logger.info('LiFi', 'Integrator fee enabled', {
      integrator: LIFI_INTEGRATOR,
      fee: LIFI_FEE,
    });
  }
}

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

/** USD value of the integrator's share from Li.Fi feeCosts.feeSplit (if present). */
export function integratorFeeUsdFromQuote(json: {
  estimate?: { feeCosts?: Array<{
    token?: { decimals?: number; priceUSD?: string };
    feeSplit?: {
      recipients?: Array<{ name?: string; fee?: string }>;
    };
  }> };
}): number {
  if (!LIFI_INTEGRATOR) return 0;
  for (const cost of json.estimate?.feeCosts ?? []) {
    const token = cost.token;
    const recipients = cost.feeSplit?.recipients;
    if (!token?.decimals || !recipients?.length) continue;
    const row = recipients.find((r) => r.name === LIFI_INTEGRATOR);
    if (!row?.fee) continue;
    const amount = Number(row.fee) / 10 ** token.decimals;
    const price = parseFloat(token.priceUSD ?? '1');
    if (Number.isFinite(amount) && Number.isFinite(price)) {
      return amount * price;
    }
  }
  return 0;
}
