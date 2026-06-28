import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SUPPORTED_CURRENCIES, getCurrencyName, type Currency } from '../../../shared/utils/currencyFormatter';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import PreferencePickerModal from './PreferencePickerModal';

interface BaseCurrencySelectorProps {
  selectedCurrency: Currency;
  onSelectCurrency: (currency: Currency) => void;
}

export default function BaseCurrencySelector({ selectedCurrency, onSelectCurrency }: BaseCurrencySelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <>
      <TouchableOpacity
        onPress={() => setModalVisible(true)}
        style={st.row}
        activeOpacity={0.7}
      >
        <View style={st.copy}>
          <Text style={st.label}>{t('settings.baseCurrency')}</Text>
          <Text style={st.description}>{t('settings.currencyDescription')}</Text>
        </View>
        <View style={st.valueRow}>
          <Text style={st.value}>{selectedCurrency}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </View>
      </TouchableOpacity>

      <PreferencePickerModal
        visible={modalVisible}
        title={t('settings.baseCurrency')}
        selectedId={selectedCurrency}
        options={SUPPORTED_CURRENCIES.map((currency) => ({
          id: currency,
          title: currency,
          subtitle: getCurrencyName(currency),
        }))}
        onSelect={(id) => onSelectCurrency(id as Currency)}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.primarySoft,
      marginBottom: 12,
    },
    copy: { flex: 1, marginRight: 12 },
    label: { color: c.text, fontWeight: '500' },
    description: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    valueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    value: { fontSize: 14, fontWeight: '700', color: c.primary },
  });
}
