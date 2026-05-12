import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface CryptoPriceCurrencySelectorProps {
  selectedCurrency: 'usd' | 'eur' | 'twd' | 'cny' | 'jpy';
  onSelectCurrency: (currency: 'usd' | 'eur' | 'twd' | 'cny' | 'jpy') => void;
}

const CRYPTO_SUPPORTED_CURRENCIES = ['usd', 'eur', 'twd', 'cny', 'jpy'] as const;

const CURRENCY_NAMES: Record<string, string> = {
  usd: 'US Dollar',
  eur: 'Euro',
  twd: 'Taiwan Dollar',
  cny: 'Chinese Yuan',
  jpy: 'Japanese Yen',
};

export default function CryptoPriceCurrencySelector({ 
  selectedCurrency, 
  onSelectCurrency 
}: CryptoPriceCurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useAppTranslation();
  const { colors } = useTheme();

  const handleSelectCurrency = (currency: 'usd' | 'eur' | 'twd' | 'cny' | 'jpy') => {
    onSelectCurrency(currency);
    setIsOpen(false);
  };

  return (
    <View style={{ marginBottom: 12, position: 'relative' }}>
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          padding: 16, 
          backgroundColor: colors.surface, 
          borderRadius: 12, 
          borderWidth: 1, 
          borderColor: colors.primarySoft 
        }}
      >
        <View>
          <Text style={{ color: colors.text, fontWeight: '500' }}>
            {t('settings.cryptoPriceCurrency') || 'Crypto Price Currency'}
          </Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
            {t('settings.cryptoPriceCurrencyDescription') || 'Display prices in your preferred currency'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary }}>
            {selectedCurrency.toUpperCase()}
          </Text>
          <Ionicons 
            name={isOpen ? 'chevron-up' : 'chevron-down'} 
            size={20} 
            color={colors.primary} 
          />
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={{ 
          position: 'absolute', 
          top: '100%', 
          left: 0, 
          right: 0, 
          marginTop: 8, 
          backgroundColor: colors.surface, 
          borderRadius: 12, 
          borderWidth: 1, 
          borderColor: colors.primarySoft, 
          zIndex: 1000, 
          overflow: 'hidden' 
        }}>
          {CRYPTO_SUPPORTED_CURRENCIES.map((currency, index) => (
            <TouchableOpacity
              key={currency}
              onPress={() => handleSelectCurrency(currency)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: selectedCurrency === currency ? colors.primarySoft : colors.surface,
                borderBottomWidth: index < CRYPTO_SUPPORTED_CURRENCIES.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}>
                  {currency.toUpperCase()}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  {CURRENCY_NAMES[currency]}
                </Text>
              </View>
              {selectedCurrency === currency && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
