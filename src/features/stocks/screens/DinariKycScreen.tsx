/**
 * DinariKycScreen
 *
 * Standalone Dinari onboarding stack route (legacy entry). Prefer
 * {@link DinariGateModal} from the portfolio buy flow.
 */
import React, { useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import { useDinariGate } from '../hooks/useDinari';
import DinariGateFlow from '../components/DinariGateFlow';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

export default function DinariKycScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { smartAddress, signMessage } = useKuraCardWallet();
  const gate = useDinariGate(smartAddress, signMessage);

  useEffect(() => {
    if (gate.state === 'ready') {
      navigation.goBack();
    }
  }, [gate.state, navigation]);

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.navBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
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
    root: { flex: 1, backgroundColor: c.background },
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
