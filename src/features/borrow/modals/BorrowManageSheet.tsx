/**
 * Position manage picker — borrow more vs add collateral.
 */
import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  onBorrowMore: () => void;
  onAddCollateral: () => void;
}

export default function BorrowManageSheet({
  visible,
  onClose,
  onBorrowMore,
  onAddCollateral,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.root}>
        <Pressable style={st.backdrop} onPress={onClose} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={st.handle} />
        <Text style={st.title}>{t('crypto.borrowManageAction')}</Text>
        <Text style={st.subtitle}>{t('crypto.borrowManageSubtitle')}</Text>

        <TouchableOpacity
          style={st.optionBtn}
          onPress={onBorrowMore}
          activeOpacity={0.85}
        >
          <View style={[st.optionIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
          </View>
          <View style={st.optionBody}>
            <Text style={st.optionTitle}>{t('crypto.borrowIncreaseAction')}</Text>
            <Text style={st.optionDesc}>{t('crypto.borrowManageBorrowMoreDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </TouchableOpacity>

        <TouchableOpacity
          style={st.optionBtn}
          onPress={onAddCollateral}
          activeOpacity={0.85}
        >
          <View style={[st.optionIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="layers-outline" size={22} color={colors.primary} />
          </View>
          <View style={st.optionBody}>
            <Text style={st.optionTitle}>{t('crypto.borrowAddCollateralAction')}</Text>
            <Text style={st.optionDesc}>{t('crypto.borrowManageAddCollateralDesc')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} style={st.cancelBtn} activeOpacity={0.85}>
          <Text style={st.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, justifyContent: 'flex-end' },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      backgroundColor: c.surfaceAlt,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderStrong,
      marginBottom: 16,
    },
    title: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      marginBottom: 6,
    },
    subtitle: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    optionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      marginBottom: 10,
    },
    optionIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    optionBody: { flex: 1, gap: 3 },
    optionTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    optionDesc: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
    cancelBtn: {
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 6,
    },
    cancelBtnText: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
  });
}
