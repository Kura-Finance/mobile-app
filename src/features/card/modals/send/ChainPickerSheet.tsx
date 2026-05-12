import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { ChainOption, ALL_CHAINS } from '../../hooks/useCryptoContacts';
import ChainLogo from '../../components/ChainLogo';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface Props {
  selected: ChainOption;
  onSelect: (chain: ChainOption) => void;
  onDismiss: () => void;
}

export default function ChainPickerSheet({ selected, onSelect, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={st.backdrop}>
      <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onDismiss} activeOpacity={1} />
      <View style={st.sheet}>
        <View style={st.handle} />
        <Text style={st.title}>{t('card.selectNetwork')}</Text>
        {ALL_CHAINS.map((chain) => {
          const isSelected = chain.key === selected.key;
          const isBridge = chain.key !== 'BASE';
          return (
            <TouchableOpacity
              key={chain.key}
              onPress={() => { onSelect(chain); onDismiss(); }}
              style={[st.row, isSelected && st.rowSelected]}
              activeOpacity={0.7}
            >
              <View style={st.logoWrap}>
                <ChainLogo chain={chain} size={28} />
              </View>
              <View style={st.rowText}>
                <Text style={st.rowName}>{chain.name}</Text>
                {isBridge && <Text style={st.rowSub}>{t('card.bridgeViaLifi')}</Text>}
              </View>
              {isSelected && <Ionicons name="checkmark" size={18} color={colors.primary} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', zIndex: 10 },
    sheet: {
      backgroundColor: c.backgroundElevated,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderColor: c.borderStrong,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
      elevation: 20,
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: c.borderStrong, alignSelf: 'center',
      marginTop: 12, marginBottom: 16,
    },
    title: {
      color: c.textMuted, fontSize: 12, fontWeight: '600',
      letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8,
    },
    row: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      paddingVertical: 14, paddingHorizontal: 4,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    rowSelected: { backgroundColor: 'rgba(139,92,246,0.05)', borderRadius: 10 },
    logoWrap: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    rowText: { flex: 1 },
    rowName: { color: c.text, fontSize: 15, fontWeight: '600' },
    rowSub: { color: c.textMuted, fontSize: 12, marginTop: 1 },
  });
}
