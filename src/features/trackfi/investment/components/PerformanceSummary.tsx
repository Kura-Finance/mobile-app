import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import CurrencyDisplay from '../../../../shared/components/CurrencyDisplay';
import { useFinanceStore } from '../../../../shared/store/useFinanceStore';
import { TimeRangeType } from '../../../../shared/store/finance/types';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import { calculateInvestmentPerformanceForRange } from '../utils/investmentPerformance';

interface PerformanceSummaryProps {
  timeRange?: TimeRangeType;
  historyDaysLimit: number;
}

function formatPercentage(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '+0.00%';
  }
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export default function PerformanceSummary({
  timeRange = '1W',
  historyDaysLimit,
}: PerformanceSummaryProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const assetHistory = useFinanceStore((s) => s.assetHistory);
  const calculateTotalAssets = useFinanceStore((s) => s.calculateTotalAssets);

  const metrics = calculateInvestmentPerformanceForRange(
    timeRange,
    historyDaysLimit,
    assetHistory,
    calculateTotalAssets,
  );

  const changeColor = metrics.isPositive ? '#10B981' : '#EF4444';
  const changeIcon = metrics.isPositive ? '↑' : '↓';

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 20, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 4 }}>
            {t('investments.totalAssets')}
          </Text>
          <CurrencyDisplay
            value={metrics.currentTotal}
            fontSize={36}
            color={colors.text}
            style={{ fontWeight: '700', letterSpacing: -1 }}
          />
        </View>

        {metrics.hasBaseline && (
          <View style={{ justifyContent: 'flex-start' }}>
            <View
              style={{
                backgroundColor: `${changeColor}1A`,
                borderWidth: 1,
                borderColor: `${changeColor}33`,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                alignItems: 'flex-end',
              }}
            >
              <Text style={{ color: changeColor, fontSize: 12, fontWeight: '700' }}>
                {changeIcon} {formatPercentage(metrics.changePercent)}
              </Text>
              <CurrencyDisplay
                value={Math.abs(metrics.change)}
                fontSize={10}
                color={changeColor}
                style={{ marginTop: 4 }}
              />
            </View>
          </View>
        )}
      </View>

      <Text style={{ color: colors.textFaint, fontSize: 13, marginTop: 12 }}>
        {assetHistory.length > 0
          ? `${t('investments.updated')} ${new Date(assetHistory[assetHistory.length - 1].timestamp).toLocaleDateString()}`
          : t('investments.noPerformanceData')}
      </Text>
    </View>
  );
}
