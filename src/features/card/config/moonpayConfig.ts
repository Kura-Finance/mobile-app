/**
 * MoonPay "Buy" widget configuration.
 *
 * Values are read from src/config/env.ts — see .env.example.
 */

import { env } from '../../../config/env';

export const MOONPAY_API_KEY = env.moonpayApiKey;

export const MOONPAY_ENV = env.moonpayEnv;

export const MOONPAY_BASE_URL =
  MOONPAY_ENV === 'live' ? 'https://buy.moonpay.com' : 'https://buy-sandbox.moonpay.com';

export const MOONPAY_CURRENCY_CODE = env.moonpayCurrencyCode;

export const MOONPAY_CONFIGURED = MOONPAY_API_KEY.length > 0;

export interface MoonPayUrlParams {
  walletAddress?: string;
  baseCurrencyCode?: string;
  baseCurrencyAmount?: string;
  redirectURL?: string;
}

export function buildMoonPayUrl(params: MoonPayUrlParams): string {
  const query = new URLSearchParams();
  query.set('apiKey', MOONPAY_API_KEY);
  query.set('currencyCode', MOONPAY_CURRENCY_CODE);
  if (params.walletAddress) query.set('walletAddress', params.walletAddress);
  if (params.baseCurrencyCode) query.set('baseCurrencyCode', params.baseCurrencyCode);
  if (params.baseCurrencyAmount) query.set('baseCurrencyAmount', params.baseCurrencyAmount);
  if (params.redirectURL) query.set('redirectURL', params.redirectURL);
  return `${MOONPAY_BASE_URL}?${query.toString()}`;
}
