import React, { useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import DinariGateFlow from './DinariGateFlow';
import type { useDinariGate } from '../hooks/useDinari';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface Props {
  gate: ReturnType<typeof useDinariGate>;
  onClose: () => void;
  onReady?: () => void;
}

/** In-modal overlay — must live inside StockDetailModal, not as a sibling Modal. */
export default function DinariGateOverlay({ gate, onClose, onReady }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  useEffect(() => {
    if (gate.state === 'ready') {
      onReady?.();
      onClose();
    }
  }, [gate.state, onReady, onClose]);

  return (
    <View style={[s.overlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={onClose} style={s.navBtn} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.screenTitle}>{t('crypto.dinariKycNavTitle')}</Text>
        <View style={s.navBtn} />
      </View>

      <DinariGateFlow gate={gate} />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100,
      elevation: 100,
      backgroundColor: c.background,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    navBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    screenTitle: {
      flex: 1,
      textAlign: 'center',
      color: c.text,
      fontSize: 17,
      fontWeight: '700',
    },
  });
}
