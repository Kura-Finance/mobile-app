import React, { useMemo } from 'react';
import { View, Text, Switch, StyleSheet, Platform } from 'react-native';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface PreferenceToggleProps {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Inside a grouped card — no outer border/background/margin. */
  embedded?: boolean;
  /** Last row in a group — no bottom padding adjustment needed if embedded. */
  isLast?: boolean;
}

export default function PreferenceToggle({
  label,
  description,
  value,
  onValueChange,
  embedded = false,
  isLast = false,
}: PreferenceToggleProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors, embedded, isLast), [colors, embedded, isLast]);

  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={styles.switchCol}>
        <View style={styles.switchScaled}>
          <Switch
            value={value}
            onValueChange={onValueChange}
            trackColor={{ false: colors.surfaceInput, true: colors.primary }}
            thumbColor={colors.white}
            ios_backgroundColor={colors.surfaceInput}
          />
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors, embedded: boolean, isLast: boolean) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: embedded ? 'transparent' : colors.surface,
      borderRadius: embedded ? 0 : 12,
      marginBottom: embedded ? 0 : 12,
      borderWidth: embedded ? 0 : 1,
      borderColor: colors.primarySoft,
      paddingBottom: embedded && !isLast ? 14 : 14,
    },
    textCol: {
      flex: 1,
      minWidth: 0,
      marginRight: 12,
    },
    label: {
      color: colors.text,
      fontWeight: '500',
      fontSize: 15,
    },
    description: {
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 4,
      lineHeight: 17,
    },
    switchCol: {
      width: Platform.OS === 'ios' ? 44 : 56,
      alignItems: 'flex-end',
      justifyContent: 'center',
      flexShrink: 0,
    },
    switchScaled: Platform.select({
      ios: {
        transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }],
        marginRight: -6,
      },
      default: {},
    }),
  });
}
