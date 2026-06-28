import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface Props {
  onSelectBank: () => void;
  onSelectCrypto: () => void;
}

export default function SendMethodPicker({ onSelectBank, onSelectCrypto }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView style={{ flex: 1, paddingHorizontal: 24 }} showsVerticalScrollIndicator={false}>
      <Text style={st.prompt}>{t('card.sendMoneyPrompt')}</Text>

      <TouchableOpacity style={st.methodRow} activeOpacity={0.7} onPress={onSelectBank}>
        <View style={st.methodIconWrap}>
          <Ionicons name="person-outline" size={22} color={colors.primary} />
        </View>
        <View style={st.methodBody}>
          <Text style={st.methodTitle}>{t('card.sendMoneyBankTransfer')}</Text>
          <Text style={st.methodSub}>{t('card.sendMoneyBankTransferSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[st.methodRow, { marginTop: 10 }]}
        activeOpacity={0.7}
        onPress={onSelectCrypto}
      >
        <View style={st.methodIconWrap}>
          <Ionicons name="logo-bitcoin" size={22} color={colors.primary} />
        </View>
        <View style={st.methodBody}>
          <Text style={st.methodTitle}>{t('card.sendMoneyCrypto')}</Text>
          <Text style={st.methodSub}>{t('card.sendMoneyCryptoSub')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </TouchableOpacity>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    prompt: {
      color: c.textMuted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8,
      marginBottom: 20,
    },
    methodRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.surface,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: c.border,
    },
    methodIconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primarySoft,
    },
    methodBody: { flex: 1, gap: 4 },
    methodTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    methodSub: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  });
}
