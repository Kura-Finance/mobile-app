/**
 * Currency formatting and conversion utilities
 * Supports multiple currencies: USD, EUR, TWD, CNY, JPY
 */

export type Currency = 'USD' | 'EUR' | 'TWD' | 'CNY' | 'JPY';

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
};

export const SUPPORTED_CURRENCIES: Currency[] = ['USD', 'EUR', 'TWD', 'CNY', 'JPY'];

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
 * Parse a currency string back to a number
 * e.g., "$1,234.56" -> 1234.56
 */
export function parseCurrency(value: string, currency: Currency = 'USD'): number {
  // Remove currency symbol and whitespace
  const config = CURRENCY_CONFIGS[currency];
  let cleaned = value.replace(new RegExp(`\\${config.symbol}`, 'g'), '').trim();
  
  // Handle different locale formats
  if (currency === 'TWD' || currency === 'EUR') {
    // Remove dots/spaces used as thousand separators
    cleaned = cleaned.replace(/\./g, '').replace(/\s/g, '');
    // Replace comma with dot if it's a decimal separator
    cleaned = cleaned.replace(',', '.');
  } else {
    // For USD, dots are thousand separators, commas are decimals (in some locales)
    // But typically USD uses commas as thousand separators
    cleaned = cleaned.replace(/,/g, '');
  }
  
  return parseFloat(cleaned) || 0;
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
  };
  return names[currency];
}
