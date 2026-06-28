import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import SymbolLogo from './SymbolLogo';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import type { MorphoMarket } from '../../../lib/api/morpho/markets';
import { collateralDisplayName } from '../utils/borrowHub';

function formatApy(apy: number): string {
  if (!Number.isFinite(apy) || apy <= 0) return '—';
  return `${(apy * 100).toFixed(2)}%`;
}

interface Props {
  market: MorphoMarket;
  maxBorrowUsd: number | null;
  onPress: () => void;
  isLast?: boolean;
}

export default function BorrowCollateralRow({
  market,
  maxBorrowUsd,
  onPress,
  isLast = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const money = useMoneyFormat();
  const apy = market.avgNetBorrowApy || market.borrowApy;
  const name = collateralDisplayName(market.collateralAsset.symbol);

  return (
    <TouchableOpacity
      style={[st.row, isLast && st.rowLast]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <SymbolLogo symbol={market.collateralAsset.symbol} size={40} />
      <View style={st.mid}>
        <Text style={st.name}>{name}</Text>
        <Text style={st.sub}>
          {maxBorrowUsd == null
            ? t('crypto.borrowMaxEstimating')
            : t('crypto.borrowUpToAsset', {
                symbol: market.loanAsset.symbol,
                amount: money.compact(maxBorrowUsd),
              })}
        </Text>
      </View>
      <View style={st.right}>
        <Text style={st.apy}>{formatApy(apy)}</Text>
        <Text style={st.apyLabel}>{t('crypto.colBorrowApy')}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </TouchableOpacity>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    mid: {
      flex: 1,
      gap: 3,
    },
    name: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
    },
    sub: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '500',
    },
    right: {
      alignItems: 'flex-end',
      gap: 2,
      minWidth: 56,
    },
    apy: {
      color: c.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    apyLabel: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '500',
    },
  });
}
