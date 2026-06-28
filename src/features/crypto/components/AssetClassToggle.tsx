/**
 * Horizontally scrollable portfolio asset-class tabs.
 */
import React, { useMemo } from 'react';
import { ScrollView, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../../shared/theme/ThemeContext';
import { makePortfolioToolbarBtnStyles } from './portfolioToolbarStyles';

export type AssetClass = 'stablecoin' | 'earn' | 'stock' | 'crypto';

interface Props {
  value: AssetClass;
  onChange: (v: AssetClass) => void;
  /** When false, hide the US Stock tab. */
  stocksEnabled?: boolean;
  /** When false, hide the Earn tab. */
  earnEnabled?: boolean;
}

const TAB_ORDER: AssetClass[] = ['stablecoin', 'earn', 'stock', 'crypto'];

export default function AssetClassToggle({
  value,
  onChange,
  stocksEnabled = true,
  earnEnabled = true,
}: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const st = useMemo(() => makePortfolioToolbarBtnStyles(colors), [colors]);

  const tabs = TAB_ORDER.filter((id) => {
    if (id === 'stock' && !stocksEnabled) return false;
    if (id === 'earn' && !earnEnabled) return false;
    return true;
  });

  const labelFor = (id: AssetClass) => {
    switch (id) {
      case 'stablecoin':
        return t('crypto.portfolioGroupCash');
      case 'earn':
        return t('crypto.portfolioGroupEarn');
      case 'stock':
        return t('crypto.portfolioGroupStocks');
      default:
        return t('crypto.portfolioGroupCrypto');
    }
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {tabs.map((id) => {
        const active = value === id;
        return (
          <TouchableOpacity
            key={id}
            style={[st.tabBtn, active && st.btnActive]}
            onPress={() => onChange(id)}
            activeOpacity={0.8}
          >
            <Text style={[st.btnText, active && st.btnTextActive]} numberOfLines={1}>
              {labelFor(id)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 4,
  },
});
