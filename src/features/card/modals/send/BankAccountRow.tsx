import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { ExternalAccountResult } from '../../../../lib/api/ramp/client';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface Props {
  account: ExternalAccountResult;
  flag: string;
  onPress: () => void;
  onDelete?: () => void;
}

export default function BankAccountRow({ account, flag, onPress, onDelete }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const swipeRef = useRef<Swipeable>(null);

  const title = account.bankName || account.accountOwnerName || t('card.bankAccount');

  const row = (
    <TouchableOpacity style={st.row} onPress={onPress} activeOpacity={0.7}>
      <View style={st.bankIcon}>
        <Ionicons name="business" size={20} color={colors.primary} />
      </View>
      <View style={st.info}>
        <Text style={st.name} numberOfLines={1}>{title}</Text>
        <View style={st.meta}>
          <Text style={st.flag}>{flag}</Text>
          <Text style={st.metaText}>
            {(account.currency ?? '').toUpperCase()}
            {account.last4 ? ` · ${account.last4}` : ''}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </TouchableOpacity>
  );

  if (!onDelete) return row;

  return (
    <Swipeable
      ref={swipeRef}
      overshootRight={false}
      renderRightActions={() => (
        <TouchableOpacity
          style={st.deleteAction}
          onPress={() => {
            swipeRef.current?.close();
            onDelete();
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={t('card.remove')}
        >
          <Ionicons name="trash-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      )}
    >
      {row}
    </Swipeable>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    bankIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(139,92,246,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: { flex: 1 },
    name: { color: c.text, fontSize: 15, fontWeight: '600', marginBottom: 3 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    flag: { fontSize: 14, lineHeight: 18 },
    metaText: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
    deleteAction: {
      width: 72,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
