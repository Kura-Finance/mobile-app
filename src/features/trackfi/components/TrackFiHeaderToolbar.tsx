import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { getTrackFiHeaderHandlers } from '../navigation/trackFiHeaderHandlers';

interface Props {
  showBack: boolean;
}

export default function TrackFiHeaderToolbar({ showBack }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const handleBack = () => {
    getTrackFiHeaderHandlers()?.onBack?.();
  };

  const handleLock = () => {
    getTrackFiHeaderHandlers()?.onLock();
  };

  return (
    <View style={st.row}>
      {showBack ? (
        <TouchableOpacity
          onPress={handleBack}
          style={st.btn}
          activeOpacity={0.7}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        onPress={handleLock}
        style={st.btn}
        activeOpacity={0.7}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={t('trackfi.lockSession')}
      >
        <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    btn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
  });
}
