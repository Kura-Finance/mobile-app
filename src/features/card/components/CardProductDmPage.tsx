import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface Props {
  onGetCard: () => void;
  loading?: boolean;
}

const FEATURES = [
  {
    icon: 'logo-apple' as const,
    titleKey: 'card.dmApplePayTitle',
    bodyKey: 'card.dmApplePayBody',
  },
  {
    icon: 'gift-outline' as const,
    titleKey: 'card.dmCashbackTitle',
    bodyKey: 'card.dmCashbackBody',
  },
  {
    icon: 'checkmark-circle-outline' as const,
    titleKey: 'card.dmZeroFeesTitle',
    bodyKey: 'card.dmZeroFeesBody',
  },
  {
    icon: 'shield-checkmark-outline' as const,
    titleKey: 'card.dmSelfCustodyTitle',
    bodyKey: 'card.dmSelfCustodyBody',
  },
] as const;

export default function CardProductDmPage({ onGetCard, loading }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={s.wrap}>
      <Text style={s.heroTitle}>{t('card.dmHeroTitle')}</Text>
      <Text style={s.heroSub}>{t('card.dmHeroSub')}</Text>

      <View style={s.features}>
        {FEATURES.map(({ icon, titleKey, bodyKey }) => (
          <View key={titleKey} style={s.featureRow}>
            <View style={s.featureIconWrap}>
              <Ionicons name={icon} size={20} color={colors.primary} />
            </View>
            <View style={s.featureCopy}>
              <Text style={s.featureTitle}>{t(titleKey)}</Text>
              <Text style={s.featureBody}>{t(bodyKey)}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={s.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
        <Text style={s.infoText}>{t('card.kuraWalletWillSign')}</Text>
      </View>

      <TouchableOpacity
        style={[s.ctaBtn, loading && s.ctaBtnDisabled]}
        onPress={onGetCard}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={s.ctaText}>{t('card.getMyCard')}</Text>
        )}
      </TouchableOpacity>

      <Text style={s.footerNote}>{t('card.euUkResidentOnly')}</Text>
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
      backgroundColor: 'rgba(139,92,246,0.1)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.primarySoft,
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
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: 'rgba(139,92,246,0.08)',
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: c.primarySoft,
    },
    infoText: {
      color: c.primary,
      fontSize: 12,
      lineHeight: 17,
      flex: 1,
    },
    ctaBtn: {
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    ctaBtnDisabled: { opacity: 0.6 },
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
