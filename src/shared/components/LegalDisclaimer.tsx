import React, { useMemo } from 'react';
import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme/ThemeContext';

export type LegalDisclaimerVariant =
  | 'portfolio'
  | 'earn'
  | 'swap'
  | 'exchangeReadOnly'
  | 'securities'
  | 'moonpay'
  | 'bridge'
  | 'gnosisPayCard'
  | 'fiatRamp'
  | 'walletConnect'
  | 'riskSummary';

const I18N_KEYS: Record<LegalDisclaimerVariant, string> = {
  portfolio: 'legal.portfolioFooter',
  earn: 'legal.earnVault',
  swap: 'legal.swapTrade',
  exchangeReadOnly: 'legal.exchangeReadOnly',
  securities: 'legal.securitiesTrade',
  moonpay: 'legal.moonpay',
  bridge: 'legal.bridge',
  gnosisPayCard: 'legal.gnosisPayCard',
  fiatRamp: 'legal.fiatRamp',
  walletConnect: 'legal.walletConnect',
  riskSummary: 'legal.riskSummary',
};

interface Props {
  variant: LegalDisclaimerVariant;
  style?: StyleProp<TextStyle>;
  centered?: boolean;
}

export default function LegalDisclaimer({ variant, style, centered = true }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const textStyle = useMemo(
    () => [styles.base, { color: colors.textFaint }, centered && styles.centered, style],
    [colors.textFaint, centered, style],
  );
  return <Text style={textStyle}>{t(I18N_KEYS[variant])}</Text>;
}

const styles = StyleSheet.create({
  base: { fontSize: 11, lineHeight: 16 },
  centered: { textAlign: 'center' },
});
