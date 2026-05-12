import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors, ThemeMode } from '../../../shared/theme/theme';

interface ThemeSelectorProps {
  selectedMode: ThemeMode;
  onSelectMode: (mode: ThemeMode) => void;
}

const OPTIONS: { mode: 'light' | 'dark'; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: 'light', icon: 'sunny' },
  { mode: 'dark', icon: 'moon' },
];

export default function ThemeSelector({ selectedMode, onSelectMode }: ThemeSelectorProps) {
  const { t } = useAppTranslation();
  const { colors, scheme } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // Reflect the effective scheme so the toggle stays correct even if the stored
  // preference is still "system".
  const active = selectedMode === 'light' || selectedMode === 'dark' ? selectedMode : scheme;

  return (
    <View style={styles.container}>
      <View style={styles.labelBlock}>
        <Text style={styles.label}>{t('settings.appearance')}</Text>
        <Text style={styles.description}>{t('settings.appearanceDescription')}</Text>
      </View>

      <View style={styles.segment}>
        {OPTIONS.map((opt) => {
          const isActive = active === opt.mode;
          return (
            <TouchableOpacity
              key={opt.mode}
              onPress={() => onSelectMode(opt.mode)}
              style={[styles.segmentItem, isActive && styles.segmentItemActive]}
              activeOpacity={0.8}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={isActive ? colors.textInverse : colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: c.surface,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: c.primarySoft,
    },
    labelBlock: { flex: 1, marginRight: 12 },
    label: { color: c.text, fontWeight: '500' },
    description: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    segment: {
      flexDirection: 'row',
      backgroundColor: c.surfaceInput,
      borderRadius: 10,
      padding: 4,
      gap: 4,
    },
    segmentItem: {
      width: 40,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      borderRadius: 8,
    },
    segmentItemActive: { backgroundColor: c.primary },
  });
}
