import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

export interface PreferencePickerOption {
  id: string;
  title: string;
  subtitle?: string;
}

interface Props {
  visible: boolean;
  title: string;
  options: PreferencePickerOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export default function PreferencePickerModal({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
}: Props) {
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const handleSelect = (id: string) => {
    onSelect(id);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[st.root, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <View style={st.header}>
          <Text style={st.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={st.closeBtn}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={st.list}
          contentContainerStyle={st.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {options.map((option, index) => {
            const selected = option.id === selectedId;
            return (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleSelect(option.id)}
                style={[
                  st.row,
                  selected && st.rowSelected,
                  index < options.length - 1 && st.rowBorder,
                ]}
                activeOpacity={0.7}
              >
                <View style={st.rowCopy}>
                  <Text style={st.rowTitle}>{option.title}</Text>
                  {option.subtitle ? (
                    <Text style={st.rowSubtitle}>{option.subtitle}</Text>
                  ) : null}
                </View>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                ) : (
                  <View style={st.checkPlaceholder} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <TouchableOpacity onPress={onClose} style={st.cancelBtn} activeOpacity={0.8}>
          <Text style={st.cancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
      paddingHorizontal: 20,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    title: {
      flex: 1,
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      marginRight: 12,
    },
    closeBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      flex: 1,
    },
    listContent: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 12,
    },
    rowSelected: {
      backgroundColor: c.primarySoft,
    },
    rowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rowCopy: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: '600',
    },
    rowSubtitle: {
      color: c.textMuted,
      fontSize: 12,
    },
    checkPlaceholder: {
      width: 22,
      height: 22,
    },
    cancelBtn: {
      marginTop: 16,
      paddingVertical: 14,
      alignItems: 'center',
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    cancelText: {
      color: c.textMuted,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
