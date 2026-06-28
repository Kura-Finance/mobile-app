import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import type { DefiAllocationBucket } from '../../hooks/useDefiScreenData';

interface Props {
  segments: DefiAllocationBucket[];
  total: number;
}

const SIZE = 96;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

function Donut({ segments, total }: { segments: DefiAllocationBucket[]; total: number }) {
  const active = segments.filter((s) => s.value > 0);
  if (total <= 0 || active.length === 0) {
    return (
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke="#E5E7EB"
          strokeWidth={STROKE}
          fill="none"
        />
      </Svg>
    );
  }

  let offset = 0;
  return (
    <Svg width={SIZE} height={SIZE}>
      <G rotation="-90" origin={`${SIZE / 2}, ${SIZE / 2}`}>
        {active.map((seg) => {
          const len = (seg.value / total) * C;
          const dash = `${len} ${C - len}`;
          const el = (
            <Circle
              key={seg.id}
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              stroke={seg.color}
              strokeWidth={STROKE}
              fill="none"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
      </G>
    </Svg>
  );
}

export default function DefiAllocationCard({ segments, total }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={st.card}>
      <Text style={st.eyebrow}>{t('trackfi.defi.assetAllocation')}</Text>
      <View style={st.body}>
        <View style={st.chartCol}>
          <Donut segments={segments} total={total} />
          <View style={st.centerLabel}>
            <Text style={st.centerTotal}>
              {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(total)}
            </Text>
            <Text style={st.centerSub}>{t('trackfi.defi.total')}</Text>
          </View>
        </View>
        <View style={st.legend}>
          {segments.map((seg) => {
            const pct = total > 0 ? (seg.value / total) * 100 : 0;
            return (
              <View key={seg.id} style={st.legendRow}>
                <View style={st.legendLeft}>
                  <View style={[st.dot, { backgroundColor: seg.color }]} />
                  <Text style={st.legendLabel} numberOfLines={1}>{t(seg.labelKey)}</Text>
                </View>
                <View style={st.legendRight}>
                  <Text style={st.legendValue}>
                    {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(seg.value)}
                  </Text>
                  <Text style={st.legendPct}>{pct.toFixed(0)}%</Text>
                </View>
              </View>
            );
          })}
        </View>
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
    eyebrow: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 1.1,
      marginBottom: 12,
    },
    body: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    chartCol: {
      width: SIZE,
      height: SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerLabel: {
      position: 'absolute',
      alignItems: 'center',
    },
    centerTotal: {
      color: c.text,
      fontSize: 13,
      fontWeight: '700',
    },
    centerSub: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '500',
    },
    legend: {
      flex: 1,
      gap: 10,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    legendLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
      minWidth: 0,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendLabel: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '500',
      flex: 1,
    },
    legendRight: {
      alignItems: 'flex-end',
      minWidth: 72,
    },
    legendValue: {
      color: c.text,
      fontSize: 12,
      fontWeight: '700',
    },
    legendPct: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '500',
    },
  });
}
