import type { ExchangeRates } from '../../lib/api/exchangeRate';

let readExchangeRates: () => ExchangeRates | null = () => null;

/** App bootstrap wires this to Zustand; tests leave the default (fallback FX). */
export function setExchangeRatesReader(reader: () => ExchangeRates | null): void {
  readExchangeRates = reader;
}

export function getLiveExchangeRates(): ExchangeRates | null {
  return readExchangeRates();
}
