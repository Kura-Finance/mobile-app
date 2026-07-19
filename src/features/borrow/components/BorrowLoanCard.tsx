import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import SymbolLogo from './SymbolLogo';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import type { MorphoMarket, MorphoBorrowPosition } from '../../../lib/api/morpho/markets';
import {
  computeHealthFactor,
  formatHealthFactor,
  healthFactorRiskLevel,
  parseMarketMaxLltv,
  type LtvRiskLevel,
} from '../utils/borrowLtv';
import { loanDisplayName } from '../utils/borrowHub';

function formatApy(apy: number): string {
  if (!Number.isFinite(apy) || apy <= 0) return '—';
  return `${(apy * 100).toFixed(2)}%`;
}

interface Props {
  market: MorphoMarket;
  position: MorphoBorrowPosition;
  onPress: () => void;
}

function riskColors(c: ThemeColors, risk: LtvRiskLevel) {
  if (risk === 'danger') return { bg: 'rgba(239,68,68,0.12)', text: c.danger };
  if (risk === 'warning') return { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B' };
  return { bg: 'rgba(16,185,129,0.12)', text: '#10B981' };
}

export default function BorrowLoanCard({ market, position, onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const money = useMoneyFormat();

  const maxLltv = parseMarketMaxLltv(market.lltv);
  const healthFactor = computeHealthFactor(
    position.borrowAssetsUsd,
    position.collateralUsd,
    maxLltv,
  );
  const risk = healthFactorRiskLevel(healthFactor);
  const badge = riskColors(colors, risk);
  const apy = market.avgNetBorrowApy || market.borrowApy;
  const riskLabel = risk === 'danger'
    ? t('crypto.borrowStatusDanger')
    : risk === 'warning'
      ? t('crypto.borrowStatusWarning')
      : t('crypto.borrowStatusHealthy');

  return (
    <TouchableOpacity style={st.card} onPress={onPress} activeOpacity={0.85}>
      <View style={st.header}>
        <View style={st.titleRow}>
          <SymbolLogo symbol={market.collateralAsset.symbol} size={36} />
          <Text style={st.title}>{loanDisplayName(market.collateralAsset.symbol)}</Text>
        </View>
        <View style={[st.badge, { backgroundColor: badge.bg }]}>
          <Text style={[st.badgeText, { color: badge.text }]}>{riskLabel}</Text>
        </View>
      </View>

      <View style={st.metrics}>
        <View style={st.metric}>
          <Text style={st.metricLabel}>{t('crypto.borrowMetricBorrowed')}</Text>
          <Text style={st.metricValue}>{money.compact(position.borrowAssetsUsd)}</Text>
        </View>
        <View style={st.metric}>
          <Text style={st.metricLabel}>{t('crypto.borrowHealthFactor')}</Text>
          <Text style={[st.metricValue, { color: badge.text }]}>
            {formatHealthFactor(healthFactor)}
          </Text>
        </View>
        <View style={st.metric}>
          <Text style={st.metricLabel}>{t('crypto.colBorrowApy')}</Text>
          <Text style={[st.metricValue, st.apy]}>{formatApy(apy)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      marginHorizontal: 20,
      marginBottom: 10,
      borderRadius: 16,
      backgroundColor: c.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 14,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 8,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    title: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
      flexShrink: 1,
    },
    badge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    badgeText: {
      fontSize: 11,
      fontWeight: '700',
    },
    metrics: {
      flexDirection: 'row',
      gap: 8,
    },
    metric: {
      flex: 1,
      gap: 4,
    },
    metricLabel: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '500',
    },
    metricValue: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    apy: {
      color: c.primary,
    },
  });
}
