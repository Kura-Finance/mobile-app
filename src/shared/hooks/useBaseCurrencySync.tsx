import { useEffect } from 'react';

import { useAppStore } from '../store/useAppStore';
import { useFinanceStore } from '../store/finance';
import type { CurrencyType } from '../store/finance/types';
import { setExchangeRatesReader } from '../utils/exchangeRatesReader';

/**
 * Keeps finance-store price currency in sync with the app base-currency preference.
 * Mount once near the app root.
 */
export function BaseCurrencySync() {
  const baseCurrency = useAppStore((state) => state.preferences.baseCurrency);
  const currency = useFinanceStore((state) => state.currency);
  const setCurrency = useFinanceStore((state) => state.setCurrency);

  useEffect(() => {
    const next = baseCurrency.toLowerCase() as CurrencyType;
    if (currency !== next) {
      setCurrency(next);
    }
  }, [baseCurrency, currency, setCurrency]);

  return null;
}

/** Prefetch FX rates so useMoneyFormat can convert on first paint. */
export function ExchangeRatesBootstrap() {
  const loadExchangeRates = useAppStore((state) => state.loadExchangeRates);

  useEffect(() => {
    setExchangeRatesReader(() => useAppStore.getState().exchangeRates);
    void loadExchangeRates();
  }, [loadExchangeRates]);

  return null;
}
