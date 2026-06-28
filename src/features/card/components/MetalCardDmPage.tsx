import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import LoadingDots from '../../../shared/components/LoadingDots';
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
    icon: 'diamond-outline' as const,
    titleKey: 'card.metalDmMetalTitle',
    bodyKey: 'card.metalDmMetalBody',
  },
  {
    icon: 'airplane-outline' as const,
    titleKey: 'card.metalDmLoungeTitle',
    bodyKey: 'card.metalDmLoungeBody',
  },
  {
    icon: 'headset-outline' as const,
    titleKey: 'card.metalDmConciergeTitle',
    bodyKey: 'card.metalDmConciergeBody',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    titleKey: 'card.metalDmTravelTitle',
    bodyKey: 'card.metalDmTravelBody',
  },
] as const;

export default function MetalCardDmPage({
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
      <Text style={s.heroTitle}>{t('card.metalCardTitle')}</Text>
      <Text style={s.heroSub}>{t('card.metalDmHeroSub')}</Text>

      <View style={s.features}>
        {FEATURES.map(({ icon, titleKey, bodyKey }) => (
          <View key={titleKey} style={s.featureRow}>
            <View style={s.featureIconWrap}>
              <Ionicons name={icon} size={20} color="#B45309" />
            </View>
            <View style={s.featureCopy}>
              <Text style={s.featureTitle}>{t(titleKey)}</Text>
              <Text style={s.featureBody}>{t(bodyKey)}</Text>
            </View>
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

      <Text style={s.footerNote}>{t('card.metalCardDetailsNote')}</Text>
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
    features: { gap: 16 },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
    },
    featureIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: 'rgba(180,83,9,0.1)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(180,83,9,0.22)',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    featureCopy: { flex: 1, gap: 4 },
    featureTitle: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    featureBody: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
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
