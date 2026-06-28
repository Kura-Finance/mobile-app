import React, { useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import {
  INVEST_SORT_OPTIONS,
  type InvestSortKey,
} from '../../utils/investSort';

interface Props {
  visible: boolean;
  selected: InvestSortKey;
  onSelect: (key: InvestSortKey) => void;
  onClose: () => void;
  /** Defaults to token list options (includes market cap). */
  options?: InvestSortKey[];
}

const SORT_I18N: Record<InvestSortKey, string> = {
  price: 'crypto.sortPrice',
  marketCap: 'crypto.sortMarketCap',
  gainers: 'crypto.sortGainers',
  losers: 'crypto.sortLosers',
};

export default function InvestSortSheet({
  visible,
  selected,
  onSelect,
  onClose,
  options = INVEST_SORT_OPTIONS,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={st.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
        <View style={st.sheet}>
          <View style={st.handle} />
          <Text style={st.title}>{t('crypto.sortBy')}</Text>
          {options.map((key) => {
            const active = key === selected;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => {
                  onSelect(key);
                  onClose();
                }}
                style={[st.row, active && st.rowActive]}
                activeOpacity={0.7}
              >
                <Text style={[st.rowLabel, active && st.rowLabelActive]}>
                  {t(SORT_I18N[key])}
                </Text>
                {active ? (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      backgroundColor: c.backgroundElevated,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingBottom: 32,
      borderTopWidth: 1,
      borderColor: c.borderStrong,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderStrong,
      alignSelf: 'center',
      marginTop: 12,
      marginBottom: 16,
    },
    title: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '600',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowActive: {},
    rowLabel: {
      color: c.text,
      fontSize: 16,
      fontWeight: '500',
    },
    rowLabelActive: {
      color: c.primary,
      fontWeight: '600',
    },
  });
}
