import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORTED_CURRENCIES, getCurrencyName, type Currency } from '../../../shared/utils/currencyFormatter';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface BaseCurrencySelectorProps {
  selectedCurrency: Currency;
  onSelectCurrency: (currency: Currency) => void;
}

export default function BaseCurrencySelector({ selectedCurrency, onSelectCurrency }: BaseCurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useAppTranslation();
  const { colors } = useTheme();

  const handleSelectCurrency = (currency: Currency) => {
    onSelectCurrency(currency);
    setIsOpen(false);
  };

  return (
    <View style={{ marginBottom: 12, position: 'relative' }}>
      <TouchableOpacity
        onPress={() => setIsOpen(!isOpen)}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.primarySoft }}
      >
        <View>
          <Text style={{ color: colors.text, fontWeight: '500' }}>{t('settings.baseCurrency')}</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{t('settings.currencyDescription')}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.primary }}>{selectedCurrency}</Text>
          <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.primary} />
        </View>
      </TouchableOpacity>

      {isOpen && (
        <View style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.primarySoft, zIndex: 1000, overflow: 'hidden' }}>
          {SUPPORTED_CURRENCIES.map((currency, index) => (
            <TouchableOpacity
              key={currency}
              onPress={() => handleSelectCurrency(currency)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: selectedCurrency === currency ? colors.primarySoft : colors.surface,
                borderBottomWidth: index < SUPPORTED_CURRENCIES.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <View>
                <Text style={{ color: colors.text, fontWeight: '500', fontSize: 14 }}>{currency}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{getCurrencyName(currency)}</Text>
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
