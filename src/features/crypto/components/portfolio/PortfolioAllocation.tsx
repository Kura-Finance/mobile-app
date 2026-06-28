import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import type { AllocationSlice } from '../../utils/portfolioAllocation';

interface Props {
  slices: AllocationSlice[];
  onSeeDetails?: () => void;
}

export default function PortfolioAllocation({ slices, onSeeDetails }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const barSlices = slices.filter((s) => s.pct > 0);

  return (
    <View style={st.card}>
      <View style={st.header}>
        <Text style={st.title}>{t('crypto.allocation')}</Text>
        {onSeeDetails ? (
          <TouchableOpacity style={st.detailsBtn} onPress={onSeeDetails} activeOpacity={0.7}>
            <Text style={st.detailsText}>{t('crypto.allocationSeeDetails')}</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={st.legend}>
        {slices.map((slice) => (
          <View key={slice.key} style={st.legendItem}>
            <View style={st.legendTop}>
              <View style={[st.dot, { backgroundColor: slice.color }]} />
              <Text style={st.legendLabel}>{t(slice.labelKey)}</Text>
            </View>
            <Text style={st.legendPct}>{slice.pct.toFixed(0)}%</Text>
          </View>
        ))}
      </View>

      <View style={st.barTrack}>
        {barSlices.map((slice, index) => (
          <View
            key={slice.key}
            style={[
              st.barSegment,
              {
                flex: slice.pct,
                backgroundColor: slice.color,
                borderTopLeftRadius: index === 0 ? 6 : 0,
                borderBottomLeftRadius: index === 0 ? 6 : 0,
                borderTopRightRadius: index === barSlices.length - 1 ? 6 : 0,
                borderBottomRightRadius: index === barSlices.length - 1 ? 6 : 0,
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    title: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
    },
    detailsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    detailsText: {
      color: c.primary,
      fontSize: 13,
      fontWeight: '600',
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
