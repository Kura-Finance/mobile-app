/**
 * Compact Crypto / Stock segmented toggle.
 *
 * Sized to sit inline inside the portfolio column-header row (between the
 * "Asset" and "Holdings" labels). Shared by CryptoScreen and StocksView so the
 * control looks identical regardless of which asset class is active.
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

export type AssetClass = 'crypto' | 'stock';

interface Props {
  value: AssetClass;
  onChange: (v: AssetClass) => void;
  /** When false, only the crypto segment is shown (no Dinari / backend). */
  stocksEnabled?: boolean;
}

export default function AssetClassToggle({ value, onChange, stocksEnabled = true }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const st = useMemo(() => makeStyles(colors), [colors]);

  if (!stocksEnabled) {
    return null;
  }

  return (
    <View style={st.segment}>
      <TouchableOpacity
        style={[st.segmentBtn, value === 'crypto' && st.segmentBtnActive]}
        onPress={() => onChange('crypto')}
        activeOpacity={0.8}
      >
        <Text style={[st.segmentText, value === 'crypto' && st.segmentTextActive]}>
          {t('crypto.tabCrypto')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[st.segmentBtn, value === 'stock' && st.segmentBtnActive]}
        onPress={() => onChange('stock')}
        activeOpacity={0.8}
      >
        <Text style={[st.segmentText, value === 'stock' && st.segmentTextActive]}>
          {t('crypto.tabStocks')}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    segment: {
      flexDirection: 'row',
      backgroundColor: c.surfaceInput,
      borderRadius: 9,
      padding: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    segmentBtn: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentBtnActive: {
      backgroundColor: c.primary,
    },
    segmentText: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '700',
    },
    segmentTextActive: {
      color: '#FFFFFF',
    },
  });
}
