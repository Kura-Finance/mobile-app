import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import MarketPairLogo from '../../../borrow/components/MarketPairLogo';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import type { MorphoMarket } from '../../../../lib/api/morpho/markets';

function formatApy(apy: number): string {
  if (!Number.isFinite(apy) || apy <= 0) return '—';
  return `${(apy * 100).toFixed(2)}%`;
}

interface Props {
  market: MorphoMarket;
  borrowedUsd: number;
  onPress: (market: MorphoMarket) => void;
}

export default function PortfolioBorrowRow({ market, borrowedUsd, onPress }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const money = useMoneyFormat();
  const apy = market.avgNetBorrowApy || market.borrowApy;
  const pairLabel = `${market.collateralAsset.symbol} / ${market.loanAsset.symbol}`;

  return (
    <TouchableOpacity style={st.row} onPress={() => onPress(market)} activeOpacity={0.65}>
      <MarketPairLogo
        collateral={market.collateralAsset.symbol}
        loan={market.loanAsset.symbol}
      />
      <View style={st.mid}>
        <View style={st.nameRow}>
          <Text style={st.name} numberOfLines={1}>{pairLabel}</Text>
          <View style={st.networkBadge}>
            <Text style={st.networkBadgeText}>Base</Text>
          </View>
        </View>
        <Text style={st.apy}>{formatApy(apy)} APY</Text>
      </View>
      <View style={st.right}>
        <Text style={st.value}>{money.compact(borrowedUsd)}</Text>
        <Text style={st.sub}>{market.loanAsset.symbol}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </TouchableOpacity>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 12,
    },
    mid: { flex: 1, gap: 4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    name: { color: c.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
    networkBadge: {
      backgroundColor: c.surface,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    networkBadgeText: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '600',
    },
    apy: { color: '#F59E0B', fontSize: 12, fontWeight: '600' },
    right: { alignItems: 'flex-end', gap: 3 },
    value: { color: c.text, fontSize: 15, fontWeight: '700' },
    sub: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
  });
}
