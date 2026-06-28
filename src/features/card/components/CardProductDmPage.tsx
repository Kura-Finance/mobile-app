import LoadingDots from '../../../shared/components/LoadingDots';
import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface Props {
  onNotify: () => void;
  notifyLoading?: boolean;
  notifyJoined?: boolean;
  notifyDisabled?: boolean;
}

const FEATURES = [
  {
    icon: 'phone-portrait-outline' as const,
    titleKey: 'card.dmVirtualPayTitle',
  },
  {
    icon: 'gift-outline' as const,
    titleKey: 'card.dmCashbackHalfTitle',
  },
  {
    icon: 'globe-outline' as const,
    titleKey: 'card.dmZeroFxTitle',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    titleKey: 'card.dmSelfCustodyShortTitle',
  },
] as const;

export default function CardProductDmPage({
  onNotify,
  notifyLoading = false,
  notifyJoined = false,
  notifyDisabled = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.wrap}>
      <Text style={s.heroTitle}>{t('card.dmHeroTitle')}</Text>
      <Text style={s.heroSub}>{t('card.dmHeroSub')}</Text>

      <View style={s.features}>
        {FEATURES.map(({ icon, titleKey }) => (
          <View key={titleKey} style={s.featureRow}>
            <View style={s.featureIconWrap}>
              <Ionicons name={icon} size={20} color={colors.primary} />
            </View>
            <Text style={s.featureTitle}>{t(titleKey)}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[s.ctaBtn, (notifyDisabled || notifyJoined) && { opacity: notifyJoined ? 0.72 : 0.55 }]}
        onPress={onNotify}
        disabled={notifyDisabled || notifyJoined || notifyLoading}
        activeOpacity={0.85}
      >
        {notifyLoading ? (
          <LoadingDots compact color="#FFFFFF" size={6}    />
        ) : (
          <Text style={s.ctaText}>
            {notifyJoined ? t('card.notifyJoined') : t('card.notifyMe')}
          </Text>
        )}
      </TouchableOpacity>

      <Text style={s.footerNote}>{t('card.virtualCardWaitlistNote')}</Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: { gap: 18 },
    heroTitle: {
      color: c.text,
      fontSize: 24,
      fontWeight: '800',
      lineHeight: 30,
      letterSpacing: -0.3,
    },
    heroSub: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 21,
      marginTop: -6,
    },
    features: { gap: 14 },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    featureIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(139,92,246,0.1)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
      flex: 1,
    },
    ctaBtn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      minHeight: 48,
      justifyContent: 'center',
    },
    ctaText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    footerNote: {
      color: c.textFaint,
      fontSize: 12,
      lineHeight: 17,
      textAlign: 'center',
      marginTop: -6,
    },
  });
}
