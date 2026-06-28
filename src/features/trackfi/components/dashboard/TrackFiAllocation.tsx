import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import type { AllocationSegment } from '../../hooks/useTrackFiDashboardData';

interface Props {
  segments: AllocationSegment[];
  denominator: number;
}

export default function TrackFiAllocation({ segments, denominator }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const barSegments = segments.filter((s) => s.value > 0);

  return (
    <View style={st.card}>
      <Text style={st.title}>{t('trackfi.dashboard.assetAllocation')}</Text>

      <View style={st.legend}>
        {segments.map((seg) => {
          const pct = denominator > 0 ? (seg.value / denominator) * 100 : 0;
          return (
            <View key={seg.id} style={st.legendItem}>
              <View style={st.legendTop}>
                <View style={[st.dot, { backgroundColor: seg.color }]} />
                <Text style={st.legendLabel} numberOfLines={1}>{t(seg.labelKey)}</Text>
              </View>
              <Text style={st.legendPct}>{pct.toFixed(0)}%</Text>
            </View>
          );
        })}
      </View>

      <View style={st.barTrack}>
        {barSegments.map((seg, index) => (
          <View
            key={seg.id}
            style={[
              st.barSegment,
              {
                flex: seg.value,
                backgroundColor: seg.color,
                borderTopLeftRadius: index === 0 ? 6 : 0,
                borderBottomLeftRadius: index === 0 ? 6 : 0,
                borderTopRightRadius: index === barSegments.length - 1 ? 6 : 0,
                borderBottomRightRadius: index === barSegments.length - 1 ? 6 : 0,
              },
            ]}
          />
        ))}
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
      marginHorizontal: 20,
      marginBottom: 20,
    },
    title: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
      marginBottom: 16,
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
      gap: 8,
    },
    legendItem: {
      flex: 1,
      gap: 6,
    },
    legendTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
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
      flexShrink: 1,
    },
    legendPct: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
      paddingLeft: 14,
    },
    barTrack: {
      flexDirection: 'row',
      height: 8,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: c.surface,
    },
    barSegment: {
      height: '100%',
      minWidth: 0,
    },
  });
}
