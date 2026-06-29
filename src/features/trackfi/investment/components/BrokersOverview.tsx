import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useFinanceStore } from '../../../../shared/store/finance';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { useAppStore } from '../../../../shared/store/useAppStore';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import type { TimeRangeType } from '../../../../shared/store/finance/types';
import { calculateInvestmentPerformanceForRange } from '../utils/investmentPerformance';
import LoadingDots from '../../../../shared/components/LoadingDots';

interface Props {
  timeRange?: TimeRangeType;
  historyDaysLimit: number;
  isLoading?: boolean;
  /** Render without outer card — for use inside a combined portfolio card */
  embedded?: boolean;
}

function formatPercentage(value: number | undefined): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '+0.00%';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export default function BrokersOverview({
  timeRange = '1W',
  historyDaysLimit,
  isLoading = false,
  embedded = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const setHideBalance = useAppStore((s) => s.setHideBalance);
  const st = useMemo(() => makeStyles(colors), [colors]);

  const assetHistory = useFinanceStore((s) => s.assetHistory);
  const calculateTotalAssets = useFinanceStore((s) => s.calculateTotalAssets);

  const metrics = calculateInvestmentPerformanceForRange(
    timeRange,
    historyDaysLimit,
    assetHistory,
    calculateTotalAssets,
  );

  const changeColor = metrics.isPositive ? colors.success : colors.danger;

  return (
    <View style={embedded ? st.embedded : st.card}>
      <View style={st.header}>
        <Text style={st.title}>{t('trackfi.brokers.portfolioOverview')}</Text>
        <TouchableOpacity
          onPress={() => setHideBalance(!hideBalance)}
          hitSlop={8}
          activeOpacity={0.7}
          style={st.hideBtn}
          accessibilityRole="button"
          accessibilityLabel={t('trackfi.banking.hideBalances')}
        >
          <Ionicons
            name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
            size={16}
            color={colors.textMuted}
          />
        </TouchableOpacity>
      </View>

      <Text style={st.statLabel}>{t('investments.totalAssets')}</Text>
      <View style={st.valueRow}>
        {isLoading ? (
          <LoadingDots color={colors.text} size={10} />
        ) : (
          <Text style={st.statValue}>
            {hideBalance ? HIDDEN_BALANCE_TEXT : money.value(metrics.currentTotal)}
          </Text>
        )}
        {!isLoading && metrics.hasBaseline ? (
          <View style={[st.changePill, { backgroundColor: `${changeColor}18` }]}>
            <Text style={[st.changePillText, { color: changeColor }]}>
              {metrics.isPositive ? '↑' : '↓'} {formatPercentage(metrics.changePercent)}
            </Text>
          </View>
        ) : !isLoading ? (
          <View style={st.changePillMuted}>
            <Text style={st.changePillMutedText}>{t('investments.noPerformanceData')}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 16,
      marginBottom: 16,
    },
    embedded: {
      paddingBottom: 0,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    title: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
    },
    hideBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statLabel: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.6,
      marginBottom: 4,
    },
    valueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 4,
    },
    statValue: {
      color: c.text,
      fontSize: 26,
      fontWeight: '700',
      letterSpacing: -0.6,
    },
    changePill: {
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    changePillText: {
      fontSize: 11,
      fontWeight: '600',
    },
    changePillMuted: {
      backgroundColor: c.surfaceInput,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    changePillMutedText: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '600',
    },
  });
}
