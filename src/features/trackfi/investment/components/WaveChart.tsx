import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Path, Stop } from 'react-native-svg';
import { useFinanceStore } from '../../../../shared/store/useFinanceStore';
import { BROKER_TIME_RANGES, daysForTimeRange, TimeRangeType } from '../../../../shared/store/finance/types';
import { BASIC_ASSET_HISTORY_DAYS } from '../../../../shared/utils/membership';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import {
  calculateInvestmentPerformanceForRange,
  investmentTotalFromSnapshot,
  snapshotsInTimeRange,
} from '../utils/investmentPerformance';

interface WaveChartProps {
  selectedTimeRange: TimeRangeType;
  historyDaysLimit: number;
  onTimeRangeChange: (timeRange: TimeRangeType) => void;
  /** Render inside a parent card without its own border/background */
  embedded?: boolean;
}
const CHART_WIDTH = Dimensions.get('window').width - 64; // 20 screen pad + 12 card pad each side
const TIME_RANGE_LABEL_KEYS: Record<TimeRangeType, string> = {
  '1W': 'investments.timeRange1W',
  '1M': 'investments.timeRange1M',
  '6M': 'investments.timeRange6M',
  '1Y': 'investments.timeRange1Y',
};
const CHART_HEIGHT = 96;
const CHART_PADDING = 10;

interface ChartPoint {
  x: number;
  y: number;
  value: number;
}

function getSnapshotsForTimeRange(
  assetHistory: typeof useFinanceStore.getState extends () => infer T ? (T extends { assetHistory: infer U } ? U : never) : never,
  daysInRange: number,
): ChartPoint[] {
  const snapshotsInRange = snapshotsInTimeRange(assetHistory, daysInRange);

  if (snapshotsInRange.length === 0) {
    return [];
  }

  // Plot broker + exchange scope (not full net worth including banking / DeFi).
  const raw = snapshotsInRange.map((s) => investmentTotalFromSnapshot(s));

  const MAX_POINTS = 48;
  let series: number[];
  if (raw.length <= MAX_POINTS) {
    series = raw;
  } else {
    series = [];
    for (let b = 0; b < MAX_POINTS; b++) {
      const start = Math.floor((b * raw.length) / MAX_POINTS);
      const end = Math.max(start + 1, Math.floor(((b + 1) * raw.length) / MAX_POINTS));
      let sum = 0;
      for (let i = start; i < end; i++) sum += raw[i];
      series.push(sum / (end - start));
    }
  }

  // Moving average (window 3) — keeps endpoints, smooths the middle.
  const smoothed = series.map((v, i) => {
    if (i === 0 || i === series.length - 1) return v;
    return (series[i - 1] + v + series[i + 1]) / 3;
  });

  const minValue = Math.min(...smoothed);
  const maxValue = Math.max(...smoothed);
  const range = maxValue - minValue || 1;

  const points: ChartPoint[] = smoothed.map((value, index) => {
    const x = (index / (smoothed.length - 1 || 1)) * (CHART_WIDTH - CHART_PADDING * 2) + CHART_PADDING;
    const normalizedValue = (value - minValue) / range;
    const y = CHART_HEIGHT - normalizedValue * (CHART_HEIGHT - CHART_PADDING * 2) - CHART_PADDING;

    return { x, y, value };
  });

  return points;
}

export default function WaveChart({
  selectedTimeRange,
  historyDaysLimit,
  onTimeRangeChange,
  embedded = false,
}: WaveChartProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const assetHistory = useFinanceStore((state) => state.assetHistory);
  const calculateTotalAssets = useFinanceStore((state) => state.calculateTotalAssets);

  const requestedDays = daysForTimeRange(selectedTimeRange);
  const effectiveDays = Math.min(requestedDays, historyDaysLimit);
  const isRangeLimited = requestedDays > historyDaysLimit;

  const points = useMemo(() => {
    return getSnapshotsForTimeRange(assetHistory, effectiveDays);
  }, [assetHistory, effectiveDays]);

  const performance = useMemo(
    () =>
      calculateInvestmentPerformanceForRange(
        selectedTimeRange,
        historyDaysLimit,
        assetHistory,
        calculateTotalAssets,
      ),
    [selectedTimeRange, historyDaysLimit, assetHistory, calculateTotalAssets],
  );

  // 生成 SVG 路径（平滑曲线）— 與主畫面 PriceChart 相同的中點平滑法，
  // 避免控制點計算錯誤造成的鋸齒/過衝。
  const pathData = useMemo(() => {
    if (points.length < 2) {
      return '';
    }

    let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const midX = (prev.x + curr.x) / 2;
      path += ` C ${midX.toFixed(2)} ${prev.y.toFixed(2)}, ${midX.toFixed(2)} ${curr.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
    }

    return path;
  }, [points]);

  // Trend colour matches the change badge in PerformanceSummary.
  const isUp = performance.hasBaseline ? performance.isPositive : true;
  const stroke = isUp ? colors.success : colors.danger;

  return (
    <View style={embedded ? st.embeddedWrap : st.wrap}>
      <View style={embedded ? st.chartEmbedded : st.chartStandalone}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT} style={{ width: '100%', height: '100%' }}>
          <Defs>
            <SvgLinearGradient id="waveGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={stroke} stopOpacity={0.25} />
              <Stop offset="1" stopColor={stroke} stopOpacity={0} />
            </SvgLinearGradient>
          </Defs>

          {pathData && (
            <>
              <Path
                d={`${pathData} L ${points[points.length - 1]?.x || 0} ${CHART_HEIGHT} L ${points[0]?.x || 0} ${CHART_HEIGHT} Z`}
                fill="url(#waveGradient)"
              />
              <Path d={pathData} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
        </Svg>

        {isRangeLimited && (
          <View style={styles.limitOverlay}>
            <View style={[styles.limitBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.warning} />
              <Text style={[styles.limitText, { color: colors.textMuted }]}>
                {t('investments.historyLimitedHint', { days: BASIC_ASSET_HISTORY_DAYS })}
              </Text>
            </View>
          </View>
        )}
      </View>

      <View style={embedded ? st.rangeRowEmbedded : st.rangeRow}>
        {BROKER_TIME_RANGES.map((timeRange) => {
          const isActive = selectedTimeRange === timeRange;
          return (
            <TouchableOpacity
              key={timeRange}
              onPress={() => onTimeRangeChange(timeRange)}
              activeOpacity={0.85}
              style={[st.rangeChip, isActive && st.rangeChipActive]}
            >
              <Text style={[st.rangeText, isActive && st.rangeTextActive]}>
                {t(TIME_RANGE_LABEL_KEYS[timeRange])}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(c: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    wrap: { marginBottom: 16 },
    embeddedWrap: { marginBottom: 0 },
    chartEmbedded: {
      height: CHART_HEIGHT,
      marginHorizontal: -4,
      marginTop: 4,
      overflow: 'hidden',
    },
    chartStandalone: {
      height: CHART_HEIGHT,
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
    },
    rangeRow: {
      flexDirection: 'row',
      marginTop: 12,
      gap: 4,
    },
    rangeRowEmbedded: {
      flexDirection: 'row',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
      gap: 4,
    },
    rangeChip: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 8,
      alignItems: 'center',
    },
    rangeChipActive: {
      backgroundColor: c.primary,
    },
    rangeText: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    rangeTextActive: {
      color: c.textInverse,
    },
  });
}

const styles = StyleSheet.create({
  limitOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(11, 11, 15, 0.55)',
  },
  limitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '100%',
  },
  limitText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
  },
});
