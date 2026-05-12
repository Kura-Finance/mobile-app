/**
 * CurrencyDisplay Component
 * Displays a formatted currency value with the user's base currency
 * Supports compact formatting for smaller spaces
 */

import React from 'react';
import { Text, TextProps } from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { formatCurrency, formatCompactCurrency, convertCurrency, type Currency } from '../utils/currencyFormatter';
import { maskBalanceText } from '../utils/privacyDisplay';

interface CurrencyDisplayProps extends Omit<TextProps, 'children'> {
  value: number;
  /**
   * The original currency of the value (default: 'USD')
   * If provided and different from user's base currency, will auto-convert
   */
  valueCurrency?: Currency;
  /**
   * If true, uses compact format (e.g., $1.2M instead of $1,200,000)
   */
  compact?: boolean;
  /**
   * If provided, overrides the user's base currency for formatting
   */
  currency?: Currency;
  /**
   * Custom color for the text
   */
  color?: string;
  /**
   * Font size for the text
   */
  fontSize?: number;
}

export default function CurrencyDisplay({
  value,
  valueCurrency = 'USD',
  compact = false,
  currency: customCurrency,
  color = '#FFFFFF',
  fontSize = 16,
  style,
  ...props
}: CurrencyDisplayProps) {
  const userCurrency = useAppStore((state) => state.preferences.baseCurrency);
  const hideBalance = useAppStore((state) => state.preferences.hideBalance);
  const dynamicRates = useAppStore((state) => state.exchangeRates);
  const displayCurrency = (customCurrency || userCurrency) as Currency;

  // Use dynamic rates from store if available, otherwise fall back to hardcoded rates
  const rateMap = dynamicRates ? {
    USD: dynamicRates.USD,
    EUR: dynamicRates.EUR,
    TWD: dynamicRates.TWD,
    CNY: dynamicRates.CNY,
    JPY: dynamicRates.JPY,
  } : undefined;

  // Convert value from valueCurrency to display currency using available rates
  const convertedValue = convertCurrency(value, valueCurrency, displayCurrency, rateMap);

  const formattedValue = compact
    ? formatCompactCurrency(convertedValue, displayCurrency)
    : formatCurrency(convertedValue, displayCurrency);

  return (
    <Text
      style={[
        {
          color,
          fontSize,
          fontWeight: '600',
        },
        style,
      ]}
      {...props}
    >
      {maskBalanceText(formattedValue, hideBalance)}
    </Text>
  );
}
