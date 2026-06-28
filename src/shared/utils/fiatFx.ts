/**
 * Convert Bridge / bank fiat amounts to USD for display.
 * Rates are quoted as 1 USD = X fiat (same convention as open.er-api.com).
 */

import type { ExchangeRates } from '../../lib/api/exchangeRate';

export type FiatCode = 'USD' | 'EUR' | 'GBP' | 'BRL' | 'MXN' | 'COP';

const FALLBACK_USD_PER_FIAT: Record<FiatCode, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  BRL: 5.6,
  MXN: 17.2,
  COP: 4100,
};

const BRIDGE_FIAT = new Set<string>(['USD', 'EUR', 'GBP', 'BRL', 'MXN', 'COP']);

export function isBridgeFiatCode(code: string): boolean {
  return BRIDGE_FIAT.has(code.toUpperCase());
}

export function bridgeFiatRatesFromExchange(rates: ExchangeRates | null | undefined): Partial<Record<FiatCode, number>> {
  if (!rates) return {};
  return {
    USD: 1,
    EUR: rates.EUR,
    GBP: rates.GBP,
    BRL: rates.BRL,
    MXN: rates.MXN,
    COP: rates.COP,
  };
}

/** Convert a fiat amount to USD using live rates with static fallbacks. */
export function usdFromFiatAmount(
  amount: number,
  currency: string,
  liveRates?: ExchangeRates | null,
): number {
  const code = currency.toUpperCase();
  if (code === 'USD') return amount;
  if (!Number.isFinite(amount) || amount === 0) return 0;

  const merged = { ...FALLBACK_USD_PER_FIAT, ...bridgeFiatRatesFromExchange(liveRates) };
  const perUsd = merged[code as FiatCode];
  if (!perUsd || perUsd <= 0) return 0;
  return amount / perUsd;
}
