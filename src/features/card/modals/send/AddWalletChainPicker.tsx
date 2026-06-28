import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ChainOption, ALL_CHAINS } from '../../hooks/useCryptoContacts';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import ChainLogo from '../../components/ChainLogo';

interface Props {
  onSelectChain: (chain: ChainOption) => void;
}

export default function AddWalletChainPicker({ onSelectChain }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={st.scroll}
      showsVerticalScrollIndicator={false}
    >
      <Text style={st.prompt}>{t('card.selectNetworkSub')}</Text>
      {ALL_CHAINS.map((c) => {
        const isBridge = c.key !== 'BASE';
        return (
          <TouchableOpacity
            key={c.key}
            style={st.chainRow}
            onPress={() => onSelectChain(c)}
            activeOpacity={0.8}
          >
            <View style={[st.chainIcon, { backgroundColor: `${c.color}14` }]}>
              <ChainLogo chain={c} size={28} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.chainName}>{c.name}</Text>
              <Text style={st.chainSub}>
                {isBridge ? t('card.bridgeViaLifi') : t('card.baseDirectSend')}
              </Text>
            </View>
            {isBridge && <Text style={st.bridgeBadge}>{t('card.bridge')}</Text>}
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </TouchableOpacity>
        );
      })}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    scroll: { paddingHorizontal: 24, paddingBottom: 32 },
    prompt: {
      color: c.textMuted,
      fontSize: 15,
      lineHeight: 22,
      marginTop: 8,
      marginBottom: 20,
    },
    chainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: c.border,
    },
    chainIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chainName: { color: c.text, fontSize: 16, fontWeight: '700' },
    chainSub: { color: c.textMuted, fontSize: 13, marginTop: 2 },
    bridgeBadge: {
      fontSize: 11,
      fontWeight: '600',
      color: '#F59E0B',
      backgroundColor: 'rgba(245,158,11,0.12)',
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
      overflow: 'hidden',
    },
  });
}
