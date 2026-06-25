/**
 * Exchange Rate API Service
 * Fetches real-time exchange rates from exchangerate.host (free, no API key required)
 */

import Logger from '../../shared/utils/Logger';

export interface ExchangeRateResponse {
  result: string;
  base_code: string;
  rates: Record<string, number>;
  time_last_update_unix?: number;
}

export interface ExchangeRates {
  USD: number;
  EUR: number;
  TWD: number;
  CNY: number;
  JPY: number;
  NGN: number;
  lastUpdated: number; // Unix timestamp
}

// Using open.er-api.com which is free and doesn't require authentication
const EXCHANGE_RATE_API = 'https://open.er-api.com/v6/latest';
const CACHE_DURATION = 3600000; // 1 hour in milliseconds

/**
 * Fetch exchange rates from public API
 * All rates are relative to USD (1 USD = X)
 */
export async function fetchExchangeRates(): Promise<ExchangeRates> {
  try {
    Logger.debug('ExchangeRateAPI', 'Fetching exchange rates from API');

    const response = await fetch(`${EXCHANGE_RATE_API}?base=USD`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: Failed to fetch exchange rates`);
    }

    const data = (await response.json()) as any;

    // Log response for debugging
    Logger.debug('ExchangeRateAPI', 'API Response received', {
      result: data.result,
      baseCode: data.base_code,
      hasRates: !!data.rates,
      ratesCount: data.rates ? Object.keys(data.rates).length : 0,
    });

    // Check if response was successful and has rates
    if (data.result !== 'success' || !data.rates) {
      Logger.warn('ExchangeRateAPI', 'Invalid response structure', {
        result: data.result,
        hasRates: !!data.rates,
        fullResponse: JSON.stringify(data).substring(0, 500),
      });
      throw new Error('Invalid response: missing rates or unsuccessful result');
    }

    const rates: ExchangeRates = {
      USD: 1.0,
      EUR: data.rates.EUR || 0.92, // fallback to hardcoded if API fails
      TWD: data.rates.TWD || 31.5,
      CNY: data.rates.CNY || 7.1,
      JPY: data.rates.JPY || 150,
      NGN: data.rates.NGN || 1600,
      lastUpdated: Date.now(),
    };

    Logger.info('ExchangeRateAPI', 'Exchange rates fetched successfully', {
      rates,
      lastUpdated: new Date(data.time_last_update_unix * 1000).toISOString(),
    });

    return rates;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    Logger.error('ExchangeRateAPI', 'Failed to fetch exchange rates', {
      error: errorMessage,
    });

    // Return fallback rates if API fails
    return {
      USD: 1.0,
      EUR: 0.92,
      TWD: 31.5,
      CNY: 7.1,
      JPY: 150,
      NGN: 1600,
      lastUpdated: Date.now(),
    };
  }
}

/**
 * Check if cached rates are still valid
 */
export function isCacheValid(lastUpdated: number): boolean {
  return Date.now() - lastUpdated < CACHE_DURATION;
}
