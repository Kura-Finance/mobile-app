/**
 * useMoneyFormat
 *
 * Formats USD-denominated amounts in the user's selected base currency,
 * converting with the latest exchange rates from the store (falling back to the
 * bundled rates when none are cached yet).
 *
 * Returns memoized formatters:
 *   value(usd)        → "$1,234.56" / "NT$38,889" (base-decimal aware)
 *   compact(usd)      → "$1.2M" / "¥18.5K"
 *   price(usd)        → magnitude-adaptive decimals for asset prices
 */
import { useCallback, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import {
  convertCurrency,
  getCurrencySymbol,
  CURRENCY_CONFIGS,
  type Currency,
} from '../utils/currencyFormatter';
import { HIDDEN_BALANCE_TEXT } from '../utils/privacyDisplay';

export function useMoneyFormat() {
  const baseCurrency = useAppStore((s) => s.preferences.baseCurrency) as Currency;
  const hideBalance = useAppStore((s) => s.preferences.hideBalance);
  const dynamicRates = useAppStore((s) => s.exchangeRates);

  const rateMap = useMemo(
    () =>
      dynamicRates
        ? {
            USD: dynamicRates.USD,
            EUR: dynamicRates.EUR,
            TWD: dynamicRates.TWD,
            CNY: dynamicRates.CNY,
            JPY: dynamicRates.JPY,
            NGN: dynamicRates.NGN,
          }
        : undefined,
    [dynamicRates],
  );

  const convert = useCallback(
    (usd: number) => convertCurrency(usd, 'USD', baseCurrency, rateMap),
    [baseCurrency, rateMap],
  );

  const symbol = getCurrencySymbol(baseCurrency);
  const baseDecimals = CURRENCY_CONFIGS[baseCurrency].decimals;
  const locale = CURRENCY_CONFIGS[baseCurrency].locale;

  const value = useCallback(
    (usd: number) => {
      if (hideBalance) return HIDDEN_BALANCE_TEXT;
      const v = convert(usd);
      if (!Number.isFinite(v) || v === 0) return `${symbol}${(0).toFixed(baseDecimals)}`;
      return `${symbol}${v.toLocaleString(locale, {
        minimumFractionDigits: baseDecimals,
        maximumFractionDigits: baseDecimals,
      })}`;
    },
    [convert, symbol, baseDecimals, locale, hideBalance],
  );

  const compact = useCallback(
    (usd: number | null | undefined) => {
      if (hideBalance) return HIDDEN_BALANCE_TEXT;
      if (usd == null || !Number.isFinite(usd)) return '—';
      const v = convert(usd);
      if (v === 0) return `${symbol}${(0).toFixed(baseDecimals)}`;
      const abs = Math.abs(v);
      if (abs >= 1e12) return `${symbol}${(v / 1e12).toFixed(2)}T`;
      if (abs >= 1e9) return `${symbol}${(v / 1e9).toFixed(2)}B`;
      if (abs >= 1e6) return `${symbol}${(v / 1e6).toFixed(2)}M`;
      if (abs >= 1e3) return `${symbol}${(v / 1e3).toFixed(1)}K`;
      return `${symbol}${v.toFixed(baseDecimals)}`;
    },
    [convert, symbol, baseDecimals, hideBalance],
  );

  const price = useCallback(
    (usd: number) => {
      const v = convert(usd);
      const abs = Math.abs(v);
      let body: string;
      if (abs >= 1_000) body = v.toLocaleString(locale, { maximumFractionDigits: 0 });
      else if (abs >= 1) body = v.toFixed(2);
      else if (abs >= 0.01) body = v.toFixed(4);
      else body = v.toPrecision(4);
      return `${symbol}${body}`;
    },
    [convert, symbol, locale],
  );

  return { value, compact, price, symbol, baseCurrency, hideBalance };
}
