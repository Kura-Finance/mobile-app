import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  BridgeChain,
  LiFiBridgeQuote,
  formatBridgeReceive,
  formatBridgeFeeTotal,
  formatBridgeTime,
} from '../../../../lib/api/bridge/lifiClient';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface Props {
  quote: LiFiBridgeQuote;
  chain: BridgeChain;
}

export default function BridgeQuoteCard({ quote, chain }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const via = quote.tools.filter((tool) => tool !== 'feeCollection').join(', ') || 'Li.Fi';
  return (
    <View style={st.card}>
      <View style={st.row}>
        <Text style={st.label}>{t('card.youReceive')}</Text>
        <Text style={st.value}>{t('card.receiveOnChain', { amount: formatBridgeReceive(quote), chain: chain.name })}</Text>
      </View>
      <View style={st.divider} />
      <View style={st.row}>
        <Text style={st.label}>{t('card.bridgeFee')}</Text>
        <Text style={st.sub}>{formatBridgeFeeTotal(quote)}</Text>
      </View>
      <View style={st.row}>
        <Text style={st.label}>{t('card.estTime')}</Text>
        <Text style={st.sub}>{formatBridgeTime(quote)}</Text>
      </View>
      <View style={st.row}>
        <Text style={st.label}>{t('card.via')}</Text>
        <Text style={[st.sub, { textTransform: 'capitalize' }]}>{via}</Text>
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.borderStrong,
      padding: 16,
      marginBottom: 4,
      gap: 10,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { color: c.textMuted, fontSize: 13 },
    value: { color: c.text, fontSize: 14, fontWeight: '600' },
    sub: { color: c.text, fontSize: 13, fontWeight: '500' },
    divider: { height: 1, backgroundColor: c.borderStrong },
  });
}
