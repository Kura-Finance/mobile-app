import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface WalletErrorProps {
  message: string;
  onRetry: () => void;
}

export default function WalletError({ message, onRetry }: WalletErrorProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.container}>
      <Ionicons name="alert-circle-outline" size={40} color={colors.danger} style={{ marginBottom: 12 }} />
      <Text style={s.title}>{t('card.walletSetupFailed')}</Text>
      <Text style={s.message}>{message}</Text>
      <TouchableOpacity onPress={onRetry} style={s.btn}>
        <Text style={s.btnText}>{t('card.tryAgainLower')}</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { alignItems: 'center', paddingVertical: 48 },
    title: { color: c.danger, fontSize: 18, fontWeight: '700', marginBottom: 8 },
    message: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
    btn: { backgroundColor: c.surface, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, borderWidth: 1, borderColor: c.danger },
    btnText: { color: c.danger, fontSize: 14, fontWeight: '600' },
  });
}
