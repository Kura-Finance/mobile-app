import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import LoadingDots from '../../../../shared/components/LoadingDots';
import NetWorthChart from '../dashboard/NetWorthChart';
import {
  DEFI_CHART_RANGES,
  DEFI_CHART_RANGE_LABEL_KEYS,
  type DefiChartRange,
} from '../../hooks/useDefiScreenData';

const CARD_W = Dimensions.get('window').width - 40;
const CHART_H = 72;

interface Props {
  totalUsdValue: number;
  walletCount: number;
  chartPrices: number[];
  chartRange: DefiChartRange;
  onChartRangeChange: (range: DefiChartRange) => void;
  change: number;
  changePercent: number;
  isPositive: boolean;
  hasChange: boolean;
  totalYieldEarned: number;
  estApy: number | null;
  loading?: boolean;
}

export default function DefiOnChainCard({
  totalUsdValue,
  walletCount,
  chartPrices,
  chartRange,
  onChartRangeChange,
  change,
  changePercent,
  isPositive,
  hasChange,
  totalYieldEarned,
  estApy,
  loading,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const changeColor = isPositive ? colors.success : colors.danger;

  return (
    <View style={st.card}>
      <Text style={st.eyebrow}>{t('trackfi.defi.onChainPortfolio')}</Text>

      {loading ? (
        <LoadingDots color={colors.text} size={10} />
      ) : (
        <Text style={st.total}>
          {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(totalUsdValue)}
        </Text>
      )}

      {hasChange && !hideBalance ? (
        <Text style={[st.change, { color: changeColor }]}>
          {isPositive ? '+' : ''}{money.compact(Math.abs(change))} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%) {t('trackfi.defi.today')}
        </Text>
      ) : null}

      <View style={st.chartWrap}>
        <NetWorthChart
          prices={chartPrices}
          width={CARD_W - 8}
          height={CHART_H}
          loading={loading && chartPrices.length === 0}
          color={colors.primary}
          compact
        />
      </View>

      <View style={st.rangeRow}>
        {DEFI_CHART_RANGES.map((range) => {
          const active = chartRange === range;
          return (
            <TouchableOpacity
              key={range}
              style={[st.rangeChip, active && st.rangeChipActive]}
              onPress={() => onChartRangeChange(range)}
              activeOpacity={0.85}
            >
              <Text style={[st.rangeText, active && st.rangeTextActive]}>
                {t(DEFI_CHART_RANGE_LABEL_KEYS[range])}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={st.metricsRow}>
        <View style={st.metric}>
          <Text style={st.metricLabel}>{t('trackfi.defi.totalYieldEarned')}</Text>
          <Text style={[st.metricValue, { color: colors.success }]}>
            {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(totalYieldEarned)}
          </Text>
        </View>
        <View style={st.metric}>
          <Text style={st.metricLabel}>{t('trackfi.defi.estApy')}</Text>
          <Text style={[st.metricValue, { color: colors.primary }]}>
            {estApy != null ? `${estApy.toFixed(2)}%` : '—'}
          </Text>
        </View>
        <View style={st.metric}>
          <Text style={st.metricLabel}>{t('trackfi.defi.wallets')}</Text>
          <Text style={st.metricValue}>
            {t('trackfi.defi.walletsConnected', { count: walletCount })}
          </Text>
        </View>
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 10,
      marginBottom: 12,
    },
    eyebrow: {
      color: c.textFaint,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 1,
      marginBottom: 2,
    },
    total: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.5,
    },
    change: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
      marginBottom: 2,
    },
    chartWrap: {
      marginTop: 0,
      marginHorizontal: -6,
      marginBottom: 2,
    },
    rangeRow: {
      flexDirection: 'row',
      gap: 2,
      marginBottom: 8,
    },
    rangeChip: {
      flex: 1,
      paddingVertical: 4,
      borderRadius: 7,
      alignItems: 'center',
    },
    rangeChipActive: {
      backgroundColor: c.primary,
    },
    rangeText: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },
    rangeTextActive: {
      color: c.textInverse,
    },
    metricsRow: {
      flexDirection: 'row',
      gap: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      paddingTop: 8,
    },
    metric: {
      flex: 1,
      gap: 2,
    },
    metricLabel: {
      color: c.textFaint,
      fontSize: 8,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    metricValue: {
      color: c.text,
      fontSize: 11,
      fontWeight: '700',
    },
  });
}
