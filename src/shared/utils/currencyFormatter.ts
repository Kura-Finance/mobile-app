/**
 * Currency formatting and conversion utilities
 * Supports multiple currencies: USD, EUR, TWD, CNY, JPY, NGN
 */

export type Currency = 'USD' | 'EUR' | 'TWD' | 'CNY' | 'JPY' | 'NGN';

export interface CurrencyConfig {
  symbol: string;
  code: string;
  locale: string; // For number formatting
  decimals: number;
}

export const CURRENCY_CONFIGS: Record<Currency, CurrencyConfig> = {
  USD: {
    symbol: '$',
    code: 'USD',
    locale: 'en-US',
    decimals: 2,
  },
  EUR: {
    symbol: '€',
    code: 'EUR',
    locale: 'de-DE',
    decimals: 2,
  },
  TWD: {
    symbol: 'NT$',
    code: 'TWD',
    locale: 'zh-TW',
    decimals: 0, // Taiwan Dollar typically doesn't show decimals
  },
  CNY: {
    symbol: '¥',
    code: 'CNY',
    locale: 'zh-CN',
    decimals: 2,
  },
  JPY: {
    symbol: '¥',
    code: 'JPY',
    locale: 'ja-JP',
    decimals: 0, // Japanese Yen has no minor unit
  },
  NGN: {
    symbol: '₦',
    code: 'NGN',
    locale: 'en-NG',
    decimals: 2,
  },
};

export const SUPPORTED_CURRENCIES: Currency[] = ['USD', 'EUR', 'TWD', 'CNY', 'JPY', 'NGN'];

/**
 * Exchange rates relative to USD (1 USD = X)
 * These are example rates - in production, fetch from API (e.g., exchangerate-api.com)
 * Updated: 2026-04-09
 */
export const EXCHANGE_RATES: Record<Currency, number> = {
  USD: 1.0,
  EUR: 0.92, // 1 USD = 0.92 EUR
  TWD: 31.5, // 1 USD = 31.5 TWD
  CNY: 7.1, // 1 USD = 7.1 CNY
  JPY: 150, // 1 USD = 150 JPY
  NGN: 1600, // 1 USD = 1600 NGN
};

/**
 * Format a number as currency with locale-specific formatting
 * @param value - The numeric value
 * @param currency - The currency code
 * @returns Formatted currency string
 */
export function formatCurrency(value: number | undefined, currency: Currency = 'USD'): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '$0.00';
  }
  
  try {
    const config = CURRENCY_CONFIGS[currency];
    
    // Format using locale-specific number formatting
    const formatter = new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: config.code,
      minimumFractionDigits: config.decimals,
      maximumFractionDigits: config.decimals,
    });
    
    return formatter.format(value);
  } catch {
    // Fallback: simple formatting if Intl.NumberFormat fails
    const config = CURRENCY_CONFIGS[currency];
    return `${config.symbol}${(value ?? 0).toFixed(config.decimals)}`;
  }
}

/**
 * Format a number as compact currency (for lists, cards, etc.)
 * e.g., $1.2M, €500K
 * @param value - The numeric value
 * @param currency - The currency code
 * @returns Formatted compact currency string
 */
export function formatCompactCurrency(value: number | undefined, currency: Currency = 'USD'): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '$0';
  }
  
  const config = CURRENCY_CONFIGS[currency];
  
  const absValue = Math.abs(value);
  let formattedValue: string;
  
  if (absValue >= 1_000_000) {
    formattedValue = (value / 1_000_000).toFixed(1) + 'M';
  } else if (absValue >= 1_000) {
    formattedValue = (value / 1_000).toFixed(1) + 'K';
  } else {
    formattedValue = (value ?? 0).toFixed(config.decimals);
  }
  
  return `${config.symbol}${formattedValue}`;
}

/**
 * Get currency symbol for a given currency
 */
export function getCurrencySymbol(currency: Currency): string {
  return CURRENCY_CONFIGS[currency].symbol;
}

/**
 * Get currency code for a given currency
 */
export function getCurrencyCode(currency: Currency): string {
  return CURRENCY_CONFIGS[currency].code;
}

/**
 * Convert between currencies using provided exchange rates
 * Rates are relative to USD (base currency)
 * @param value - The amount to convert
 * @param fromCurrency - Source currency
 * @param toCurrency - Target currency
 * @param rates - Exchange rates map (uses EXCHANGE_RATES as fallback)
 * @returns Converted amount
 */
export function convertCurrency(
  value: number,
  fromCurrency: Currency,
  toCurrency: Currency,
  rates?: Record<Currency, number>
): number {
  if (fromCurrency === toCurrency) {
    return value;
  }
  
  const rateMap = rates || EXCHANGE_RATES;
  
  // Convert from source currency to USD
  const valueInUSD = value / rateMap[fromCurrency];
  
  // Convert from USD to target currency
  return valueInUSD * rateMap[toCurrency];
}

/**
 * Get currency display name
 */
export function getCurrencyName(currency: Currency): string {
  const names: Record<Currency, string> = {
    USD: 'US Dollar',
    EUR: 'Euro',
    TWD: 'Taiwan Dollar',
    CNY: 'Chinese Yuan',
    JPY: 'Japanese Yen',
    NGN: 'Nigerian Naira',
  };
  return names[currency];
}
