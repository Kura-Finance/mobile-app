import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/theme/ThemeContext';
import StandardCard from './StandardCard';
import MetalCard from './MetalCard';
import { CARD_WIDTH, CARD_HEIGHT } from './VirtualCard';

interface CardApplyBannerProps {
  onPress: () => void;
  /** Last four digits of the debit card; defaults to 0000 when unset. */
  last4?: string;
}

function formatBannerLast4(last4?: string): string {
  const digits = last4?.replace(/\D/g, '').slice(-4);
  return `•••• ${digits && digits.length === 4 ? digits : '0000'}`;
}

export function CardApplyBanner({ onPress, last4 }: CardApplyBannerProps) {
  const { t } = useTranslation();
  const { scheme } = useTheme();
  const s = useMemo(() => makeStyles(), []);
  const isDark = scheme === 'dark';
  const overlayText = isDark ? s.overlayTextDark : s.overlayTextLight;
  const chevronColor = isDark ? 'rgba(237,233,254,0.85)' : '#64748B';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={s.applyWrap}>
      <View style={s.cardShell}>
        {isDark ? (
          <StandardCard masked showCornerLabel={false} />
        ) : (
          <MetalCard showCornerLabel={false} />
        )}
        <View style={s.chevronWrap} pointerEvents="none">
          <Ionicons name="chevron-forward" size={24} color={chevronColor} />
        </View>
        <View style={s.bottomRow} pointerEvents="none">
          <View style={s.spendableCol}>
            <Text style={[s.spendableLabel, overlayText]}>{t('card.spendable')}</Text>
            <Text style={[s.spendableAmount, overlayText]}>—</Text>
          </View>
          <Text style={[s.last4Text, overlayText]}>{formatBannerLast4(last4)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles() {
  return StyleSheet.create({
    applyWrap: {
      marginBottom: 20,
      alignItems: 'center',
    },
    cardShell: {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chevronWrap: {
      position: 'absolute',
      right: 20,
      top: '50%',
      marginTop: -12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bottomRow: {
      position: 'absolute',
      left: 16,
      right: 16,
      bottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    spendableCol: {
      flexShrink: 1,
      gap: 2,
    },
    spendableLabel: {
      fontSize: 10,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      opacity: 0.72,
    },
    spendableAmount: {
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.2,
      fontVariant: ['tabular-nums'],
    },
    overlayTextDark: {
      color: 'rgba(237,233,254,0.95)',
    },
    overlayTextLight: {
      color: '#0F172A',
    },
    last4Text: {
      flexShrink: 0,
      fontSize: 13,
      fontWeight: '600',
      letterSpacing: 1.2,
      fontVariant: ['tabular-nums'],
    },
  });
}
