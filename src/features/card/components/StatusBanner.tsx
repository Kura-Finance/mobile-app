import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import GnosisPayLogo from './GnosisPayLogo';

// ─────────────────────────────────────────────────────────────────────────────
// Generic status banner (KYC pending/rejected/issuing/frozen)
// ─────────────────────────────────────────────────────────────────────────────

interface StatusBannerProps {
  color: string;
  bgColor: string;
  borderColor: string;
  icon?: string;
  title: string;
  subtitle: string;
  loading?: boolean;
  onPress?: () => void;
  onRetry?: () => void;
  retryLabel?: string;
}

export function StatusBanner({
  color,
  bgColor,
  borderColor,
  icon,
  title,
  subtitle,
  loading = false,
  onPress,
  onRetry,
  retryLabel,
}: StatusBannerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const content = (
    <LinearGradient
      colors={[bgColor, bgColor.replace('0.12', '0.06')]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={s.gradient}
    >
      {loading
        ? <ActivityIndicator size="small" color={color} style={{ marginRight: 12 }} />
        : icon
          ? <Ionicons name={icon as any} size={20} color={color} style={{ marginRight: 12 }} />
          : null
      }
      <View style={{ flex: 1 }}>
        <Text style={[s.title, { color }]}>{title}</Text>
        <Text style={s.subtitle}>{subtitle}</Text>
      </View>
      {onRetry && !loading && (
        <TouchableOpacity
          onPress={onRetry}
          style={[s.retryBtn, { borderColor: color }]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="refresh-outline" size={12} color={color} />
          <Text style={[s.retryText, { color }]}>{retryLabel ?? t('card.retry')}</Text>
        </TouchableOpacity>
      )}
      {onPress && !loading && !onRetry && (
        <Ionicons name="chevron-forward" size={16} color={color} />
      )}
    </LinearGradient>
  );

  const wrap = [s.wrap, { borderColor }];
  return onPress
    ? <TouchableOpacity onPress={onPress} style={wrap} activeOpacity={0.8}>{content}</TouchableOpacity>
    : <View style={wrap}>{content}</View>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply banner — Gnosis Pay permissionless card
// ─────────────────────────────────────────────────────────────────────────────

interface CardApplyBannerProps {
  onApply: () => void;
  isLoading: boolean;
}

const APPLY_FEATURES = [
  { icon: 'flash-outline' as const, labelKey: 'card.applyPillFree' },
  { icon: 'logo-usd' as const, labelKey: 'card.applyPillUsdc' },
  { icon: 'card-outline' as const, labelKey: 'card.applyPillVisa' },
];

export function CardApplyBanner({ onApply, isLoading }: CardApplyBannerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);

  return (
    <TouchableOpacity
      onPress={onApply}
      disabled={isLoading}
      style={s.applyCard}
      activeOpacity={0.75}
    >
      <View style={s.applyHeader}>
        <View style={s.applyIconWrap}>
          <GnosisPayLogo size={32} />
        </View>
        <View style={s.applyBody}>
          <Text style={s.applyTitle}>{t('card.applyForCard')}</Text>
          <Text style={s.applySub}>{t('card.applyForCardSub')}</Text>
        </View>
        <View style={s.applyArrow}>
          {isLoading
            ? <ActivityIndicator size="small" color={colors.primary} />
            : <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          }
        </View>
      </View>

      <View style={s.applyFeatures}>
        {APPLY_FEATURES.map(({ icon, labelKey }) => (
          <View key={labelKey} style={s.applyFeature}>
            <Ionicons name={icon} size={12} color={colors.primaryOnSoft} />
            <Text style={s.applyFeatureText} numberOfLines={1}>{t(labelKey)}</Text>
          </View>
        ))}
      </View>

      <View style={s.applyFooter}>
        <Ionicons name="globe-outline" size={12} color={colors.textFaint} />
        <Text style={s.applyFooterText}>{t('card.euUkResidentOnly')}</Text>
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    // StatusBanner
    wrap: { marginBottom: 16, borderRadius: 14, overflow: 'hidden', borderWidth: 1 },
    gradient: { flexDirection: 'row', alignItems: 'center', padding: 14 },
    title: { fontSize: 13, fontWeight: '600', marginBottom: 2 },
    subtitle: { color: c.textMuted, fontSize: 12 },
    retryBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      borderWidth: 1, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, opacity: 0.85,
    },
    retryText: { fontSize: 11, fontWeight: '600' },

    // CardApplyBanner
    applyCard: {
      marginBottom: 20,
      borderRadius: 20,
      backgroundColor: c.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
    },
    applyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 14,
    },
    applyIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 14,
      backgroundColor: c.white,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    applyBody: { flex: 1, minWidth: 0, gap: 4 },
    applyTitle: { color: c.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
    applySub: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
    applyArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    applyFeatures: {
      flexDirection: 'row',
      marginHorizontal: 16,
      marginBottom: 12,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    applyFeature: {
      flex: 1,
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 4,
    },
    applyFeatureText: {
      color: c.textMuted,
      fontSize: 10,
      fontWeight: '600',
      textAlign: 'center',
    },
    applyFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 16,
      paddingBottom: 14,
    },
    applyFooterText: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '500',
    },
  });
}
