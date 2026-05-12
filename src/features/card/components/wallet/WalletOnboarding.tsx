import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

interface WalletOnboardingProps {
  onActivate: () => void;
  onImport: () => void;
}

export default function WalletOnboarding({ onActivate, onImport }: WalletOnboardingProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.container}>
      <LinearGradient
        colors={['rgba(139,92,246,0.12)', 'rgba(59,130,246,0.08)', 'rgba(16,185,129,0.06)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.card}
      >
        <View style={s.iconWrapper}>
          <LinearGradient
            colors={['#8B5CF6', '#3B82F6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.icon}
          >
            <Ionicons name="layers-outline" size={28} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <Text style={s.title}>{t('card.activateSmartWallet')}</Text>
        <Text style={s.subtitle}>
          {t('card.activateSmartWalletBody')}
        </Text>
        <View style={s.pills}>
          {[
            { icon: 'shield-checkmark-outline', label: t('card.nonCustodial') },
            { icon: 'flash-outline', label: t('card.gasFree') },
            { icon: 'cube-outline', label: 'ERC-4337' },
          ].map(({ icon, label }) => (
            <View key={label} style={s.pill}>
              <Ionicons name={icon as any} size={13} color={colors.primary} />
              <Text style={s.pillText}>{label}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={onActivate} style={s.activateBtn} activeOpacity={0.85}>
          <LinearGradient
            colors={['#7C3AED', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.activateGradient}
          >
            <Text style={s.activateBtnText}>{t('card.createSmartWallet')}</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
        <View style={s.networkBadge}>
          <View style={[s.networkDot, { backgroundColor: '#2775CA' }]} />
          <Text style={s.networkBadgeText}>{t('card.poweredByBaseUsdc')}</Text>
        </View>
      </LinearGradient>

      <View style={s.divider}>
        <View style={s.dividerLine} />
        <Text style={s.dividerText}>{t('card.or')}</Text>
        <View style={s.dividerLine} />
      </View>

      <TouchableOpacity style={s.connectBtn} activeOpacity={0.8} onPress={onImport}>
        <Ionicons name="download-outline" size={18} color={colors.textMuted} />
        <Text style={s.connectText}>{t('card.importWallet')}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { paddingBottom: 20 },
    card: { borderRadius: 20, padding: 24, marginBottom: 16, borderWidth: 1, borderColor: c.primarySoft, overflow: 'hidden' },
    iconWrapper: { alignItems: 'center', marginBottom: 20 },
    icon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    title: { color: c.text, fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
    subtitle: { color: c.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    pills: { flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 24 },
    pill: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      backgroundColor: 'rgba(139,92,246,0.12)', borderRadius: 20,
      paddingHorizontal: 12, paddingVertical: 6,
      borderWidth: 1, borderColor: c.primarySoft,
    },
    pillText: { color: c.primary, fontSize: 11, fontWeight: '600' },
    activateBtn: { borderRadius: 14, overflow: 'hidden', marginBottom: 16 },
    activateGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
    activateBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    networkBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
    networkDot: { width: 6, height: 6, borderRadius: 3 },
    networkBadgeText: { color: c.textMuted, fontSize: 11 },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.borderStrong },
    dividerText: { color: c.textMuted, fontSize: 12 },
    connectBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      backgroundColor: c.surface, borderRadius: 14, paddingVertical: 14,
      borderWidth: 1, borderColor: c.borderStrong,
    },
    connectText: { color: c.textMuted, fontSize: 14, fontWeight: '500' },
  });
}
