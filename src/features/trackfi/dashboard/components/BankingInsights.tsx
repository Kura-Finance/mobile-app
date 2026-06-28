import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface Props {
  onPress: () => void;
}

export default function BankingInsights({ onPress }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={st.wrap}>
      <TouchableOpacity style={st.card} onPress={onPress} activeOpacity={0.85}>
        <View style={st.iconWrap}>
          <Ionicons name="pie-chart-outline" size={20} color={colors.primary} />
        </View>
        <View style={st.body}>
          <Text style={st.title}>{t('trackfi.banking.insights')}</Text>
          <Text style={st.subtitle}>{t('trackfi.banking.insightsSubtitle')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      marginTop: 20,
      marginBottom: 4,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 16,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    title: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
    },
    subtitle: {
      color: c.textMuted,
      fontSize: 12,
    },
  });
}
