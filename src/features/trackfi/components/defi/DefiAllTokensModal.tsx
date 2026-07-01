import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  Pressable,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import type { DefiToken } from '../../hooks/useDefiPortfolio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tokens: DefiToken[];
}

const SHEET_HEIGHT = Dimensions.get('window').height * 0.75;
const HEADER_HEIGHT = 56;

export default function DefiAllTokensModal({ isOpen, onClose, tokens }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const money = useMoneyFormat();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const listHeight = SHEET_HEIGHT - HEADER_HEIGHT - Math.max(insets.bottom, 16);

  const renderItem = useCallback(
    ({ item: token }: { item: DefiToken }) => (
      <View style={st.row}>
        {token.logoUrl ? (
          <Image source={{ uri: token.logoUrl }} style={st.logo} />
        ) : (
          <View style={[st.logo, st.logoFallback]}>
            <Text style={st.logoText}>{token.symbol.slice(0, 2)}</Text>
          </View>
        )}
        <View style={st.body}>
          <Text style={st.symbol}>{token.symbol}</Text>
          <Text style={st.name} numberOfLines={1}>{token.name}</Text>
        </View>
        <Text style={st.valueText}>{money.compact(token.usdValue)}</Text>
      </View>
    ),
    [money, st],
  );

  const keyExtractor = useCallback(
    (token: DefiToken) => `${token.chain}-${token.id}`,
    [],
  );

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={st.backdrop} onPress={onClose} />
      <View style={[st.sheet, { height: SHEET_HEIGHT, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={st.handle} />
        <View style={st.header}>
          <Text style={st.title}>{t('trackfi.defi.allTokensTitle', { count: tokens.length })}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
        <FlatList
          data={tokens}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={{ maxHeight: listHeight }}
          initialNumToRender={16}
          maxToRenderPerBatch={24}
          windowSize={8}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: c.overlay,
    },
    sheet: {
      backgroundColor: c.backgroundElevated,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderStrong,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    title: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    logo: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    logoFallback: {
      backgroundColor: c.surfaceInput,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
    body: { flex: 1, minWidth: 0 },
    symbol: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    name: {
      color: c.textMuted,
      fontSize: 11,
    },
    valueText: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
