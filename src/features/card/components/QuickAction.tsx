import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

export interface QuickActionProps {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  soon?: boolean;
}

export default function QuickAction({
  icon,
  label,
  onPress,
  color,
  soon = false,
}: QuickActionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const accent = color ?? colors.primary;
  return (
    <TouchableOpacity style={s.action} onPress={onPress} disabled={soon}>
      <View style={[s.icon, { backgroundColor: `${accent}22` }]}>
        <Ionicons name={icon as any} size={22} color={soon ? colors.textFaint : accent} />
        {soon && (
          <View style={s.soon}>
            <Text style={s.soonText}>{t('card.soon')}</Text>
          </View>
        )}
      </View>
      <Text style={[s.label, { color: soon ? colors.textFaint : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export const quickActionsRow = {
  flexDirection: 'row' as const,
  justifyContent: 'space-between' as const,
  marginBottom: 28,
};

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    action: { flex: 1, alignItems: 'center', gap: 8 },
    icon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: 11, fontWeight: '500' as const },
    soon: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: c.surfaceInput,
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 1,
    },
    soonText: { color: c.textMuted, fontSize: 8, fontWeight: '600' as const },
  });
}
