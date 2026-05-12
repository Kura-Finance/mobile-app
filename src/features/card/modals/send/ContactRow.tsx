import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { CryptoContact, ChainOption, shortenAddress } from '../../hooks/useCryptoContacts';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface Props {
  contact: CryptoContact;
  chain: ChainOption;
  onPress: () => void;
  onLongPress?: () => void;
  onDelete?: () => void;
}

export default function ContactRow({ contact, chain, onPress, onLongPress, onDelete }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const swipeRef = useRef<Swipeable>(null);

  const row = (
    <TouchableOpacity
      style={st.row}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      <View style={[st.icon, { backgroundColor: `${chain.color}22` }]}>
        <Ionicons name="wallet-outline" size={20} color={chain.color} />
      </View>
      <View style={st.info}>
        <Text style={st.name}>{contact.name}</Text>
        <View style={st.meta}>
          <View style={[st.dot, { backgroundColor: chain.color }]} />
          <Text style={st.addr}>{shortenAddress(contact.address)}</Text>
          <Text style={st.chain}>{chain.name}</Text>
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
    icon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: { flex: 1 },
    name: { color: c.text, fontSize: 15, fontWeight: '600', marginBottom: 3 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3 },
    addr: {
      color: c.textMuted,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    chain: { color: c.textFaint, fontSize: 11, fontWeight: '500' },
    deleteAction: {
      width: 72,
      backgroundColor: c.danger,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
