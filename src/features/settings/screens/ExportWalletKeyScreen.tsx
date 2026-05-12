import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEmbeddedEthereumWallet } from '@privy-io/expo';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import { useAppTranslation } from '../../../shared/hooks/useAppTranslation';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { selectCanonicalEmbeddedWallet } from '../../../shared/utils/embeddedWallet';

// ─────────────────────────────────────────────────────────────────────────────
// Config — swap these URLs when the docs site is live
// ─────────────────────────────────────────────────────────────────────────────

const DOCS_URL = 'https://www.privy.io/embedded-wallets-101';

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

function Section({
  icon,
  accent,
  title,
  children,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  accent: string;
  title: string;
  children: React.ReactNode;
}) {
  const s = useStyles();
  return (
    <View style={s.section}>
      <View style={[s.sectionIconWrap, { borderColor: `${accent}40`, backgroundColor: `${accent}14` }]}>
        <Ionicons name={icon} size={20} color={accent} />
      </View>
      <View style={s.sectionBody}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.sectionText}>{children}</Text>
      </View>
    </View>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const s = useStyles();
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, mono && { fontFamily: 'monospace', fontSize: 11 }]} numberOfLines={1} ellipsizeMode="middle">
        {value}
      </Text>
    </View>
  );
}

function Step({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.step}>
      <View style={s.stepBadge}>
        <Text style={s.stepBadgeText}>{number}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.stepTitle}>{title}</Text>
        <Text style={s.stepText}>{children}</Text>
      </View>
    </View>
  );
}

export default function ExportWalletKeyScreen({ onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useAppTranslation();
  const { colors } = useTheme();
  const s = useStyles();
  const { smartAddress } = useKuraCardWallet();
  const { wallets: embeddedWallets } = useEmbeddedEthereumWallet();
  const eoaAddress = selectCanonicalEmbeddedWallet(embeddedWallets)?.address ?? null;

  return (
    <View style={s.root}>
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingTop: insets.top + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.headerTitle}>{t('walletHowItWorks.title')}</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={8}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* ── Wallet architecture diagram ─────────────────────────────── */}
        <View style={s.diagram}>
          {/* EOA box */}
          <View style={[s.diagBox, s.diagBoxEoa]}>
            <View style={s.diagIconRow}>
              <Ionicons name="key-outline" size={18} color={colors.primary} />
              <Text style={s.diagBoxLabel}>{t('walletHowItWorks.eoaLabel')}</Text>
            </View>
            <Text style={s.diagBoxSub}>{t('walletHowItWorks.eoaSub')}</Text>
            <Text style={s.diagBoxDetail}>{t('walletHowItWorks.eoaDetail')}</Text>
          </View>

          {/* Arrow */}
          <View style={s.diagArrow}>
            <Ionicons name="arrow-down" size={18} color={colors.textFaint} />
            <Text style={s.diagArrowLabel}>{t('walletHowItWorks.signsFor')}</Text>
          </View>

          {/* SCA box */}
          <View style={[s.diagBox, s.diagBoxSca]}>
            <View style={s.diagIconRow}>
              <Ionicons name="layers-outline" size={18} color={colors.success} />
              <Text style={s.diagBoxLabel}>{t('walletHowItWorks.scaLabel')}</Text>
            </View>
            <Text style={s.diagBoxSub}>{t('walletHowItWorks.scaSub')}</Text>
            <Text style={s.diagBoxDetail}>{t('walletHowItWorks.scaDetail')}</Text>
          </View>
        </View>

        {/* ── Address info ────────────────────────────────────────────── */}
        {(smartAddress || eoaAddress) ? (
          <View style={s.addrCard}>
            <Text style={s.addrCardTitle}>{t('walletHowItWorks.addressesTitle')}</Text>
            {smartAddress ? <Row label={t('walletHowItWorks.smartAccount')} value={smartAddress} mono /> : null}
            {smartAddress && eoaAddress ? <View style={s.divider} /> : null}
            {eoaAddress ? <Row label={t('walletHowItWorks.signerEoa')} value={eoaAddress} mono /> : null}
          </View>
        ) : null}

        {/* ── Explanation sections ─────────────────────────────────────── */}
        <Section icon="key-outline" accent="#8B5CF6" title={t('walletHowItWorks.sectionEoaTitle')}>
          {t('walletHowItWorks.sectionEoaBody')}
        </Section>

        <Section icon="layers-outline" accent="#10B981" title={t('walletHowItWorks.sectionScaTitle')}>
          {t('walletHowItWorks.sectionScaBody')}
        </Section>

        <Section icon="shield-outline" accent="#6366F1" title={t('walletHowItWorks.sectionWhyTitle')}>
          {t('walletHowItWorks.sectionWhyBody')}
        </Section>

        <Section icon="cloud-outline" accent="#F59E0B" title={t('walletHowItWorks.sectionBackupTitle')}>
          {t('walletHowItWorks.sectionBackupBody')}
        </Section>

        {/* ── Recover elsewhere ────────────────────────────────────────── */}
        <View style={s.recoverCard}>
          <View style={s.recoverHeader}>
            <Ionicons name="refresh-circle-outline" size={20} color="#60A5FA" />
            <Text style={s.recoverTitle}>{t('walletHowItWorks.recoverTitle')}</Text>
          </View>
          <Text style={s.recoverIntro}>
            {t('walletHowItWorks.recoverIntro')}
          </Text>

          <Step number={1} title={t('walletHowItWorks.step1Title')}>
            {t('walletHowItWorks.step1Before')}
            <Text style={s.stepHighlight}>wallet.privy.io</Text>
            {t('walletHowItWorks.step1After')}
          </Step>

          <Step number={2} title={t('walletHowItWorks.step2Title')}>
            {t('walletHowItWorks.step2Before')}
            <Text style={s.stepHighlight}>MetaMask</Text>
            {t('walletHowItWorks.step2Mid')}
            <Text style={s.stepHighlight}>Rabby</Text>
            {t('walletHowItWorks.step2Mid2')}
            <Text style={s.stepHighlight}>Rainbow</Text>
            {t('walletHowItWorks.step2After')}
          </Step>

          <Step number={3} title={t('walletHowItWorks.step3Title')}>
            {t('walletHowItWorks.step3Before')}
            <Text style={s.stepHighlight}>Safe Smart Account (SCA)</Text>
            {t('walletHowItWorks.step3Mid')}
            <Text style={s.stepHighlight}>app.safe.global</Text>
            {t('walletHowItWorks.step3After')}
          </Step>

          <Step number={4} title={t('walletHowItWorks.step4Title')}>
            {t('walletHowItWorks.step4Body')}
          </Step>
        </View>

        {/* ── Warning ──────────────────────────────────────────────────── */}
        <View style={s.warning}>
          <Ionicons name="warning-outline" size={16} color={colors.warning} style={{ marginTop: 1 }} />
          <Text style={s.warningText}>
            {t('walletHowItWorks.warning')}
          </Text>
        </View>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.ctaBtn}
          onPress={() => Linking.openURL(DOCS_URL)}
          activeOpacity={0.8}
        >
          <Ionicons name="book-outline" size={18} color={colors.background} />
          <Text style={s.ctaBtnText}>{t('walletHowItWorks.readDocs')}</Text>
          <Ionicons name="open-outline" size={14} color={colors.background} style={{ opacity: 0.6 }} />
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Frosted status bar overlay so content scrolls under it, not the status bar */}
      <BlurView
        intensity={50}
        tint="dark"
        style={[s.statusBarBlur, { height: insets.top }]}
        pointerEvents="none"
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    scroll: { paddingHorizontal: 20, paddingBottom: 40 },
    statusBarBlur: {
      position: 'absolute', top: 0, left: 0, right: 0,
      backgroundColor: 'rgba(11,11,15,0.55)',
    },

    header: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: 28,
    },
    headerTitle: { color: c.text, fontSize: 20, fontWeight: '800' },
    closeBtn: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
    },

    // Diagram
    diagram: { marginBottom: 24, gap: 0 },
    diagBox: {
      borderRadius: 14, padding: 16, gap: 4,
      borderWidth: 1,
    },
    diagBoxEoa: {
      backgroundColor: 'rgba(139,92,246,0.06)',
      borderColor: 'rgba(139,92,246,0.22)',
    },
    diagBoxSca: {
      backgroundColor: 'rgba(16,185,129,0.06)',
      borderColor: 'rgba(16,185,129,0.22)',
    },
    diagIconRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    diagBoxLabel: { color: c.text, fontSize: 14, fontWeight: '700' },
    diagBoxSub: { color: c.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
    diagBoxDetail: { color: c.textMuted, fontSize: 12, lineHeight: 18, marginTop: 4 },
    diagArrow: { alignItems: 'center', paddingVertical: 8, gap: 2 },
    diagArrowLabel: { color: c.textFaint, fontSize: 11 },

    // Addresses
    addrCard: {
      backgroundColor: c.surface, borderRadius: 14,
      padding: 16, marginBottom: 24,
      borderWidth: 1, borderColor: c.border,
    },
    addrCardTitle: {
      color: c.textFaint, fontSize: 10, fontWeight: '700',
      letterSpacing: 1.2, marginBottom: 12,
    },
    row: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12,
    },
    rowLabel: { color: c.textMuted, fontSize: 12, fontWeight: '500', flexShrink: 0 },
    rowValue: { color: c.text, fontSize: 12, flex: 1, textAlign: 'right' },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 10 },

    // Info sections
    section: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 20,
    },
    sectionIconWrap: {
      width: 40, height: 40, borderRadius: 11,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, flexShrink: 0,
    },
    sectionBody: { flex: 1 },
    sectionTitle: { color: c.text, fontSize: 14, fontWeight: '700', marginBottom: 5 },
    sectionText: { color: c.textMuted, fontSize: 13, lineHeight: 20 },

    // Recover elsewhere
    recoverCard: {
      backgroundColor: 'rgba(96,165,250,0.05)',
      borderRadius: 16, padding: 18, marginBottom: 20,
      borderWidth: 1, borderColor: 'rgba(96,165,250,0.18)',
      gap: 14,
    },
    recoverHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    recoverTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    recoverIntro: { color: c.textMuted, fontSize: 13, lineHeight: 20, marginTop: -6 },
    step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    stepBadge: {
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: 'rgba(96,165,250,0.18)',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
    },
    stepBadgeText: { color: '#60A5FA', fontSize: 12, fontWeight: '700' },
    stepTitle: { color: c.text, fontSize: 13, fontWeight: '700', marginBottom: 3 },
    stepText: { color: c.textMuted, fontSize: 13, lineHeight: 20 },
    stepHighlight: { color: '#60A5FA', fontWeight: '600' },

    // Warning
    warning: {
      flexDirection: 'row', alignItems: 'flex-start', gap: 10,
      backgroundColor: 'rgba(251,191,36,0.07)', borderRadius: 12,
      padding: 14, marginBottom: 20,
      borderWidth: 1, borderColor: 'rgba(251,191,36,0.2)',
    },
    warningText: { color: c.warning, fontSize: 12, lineHeight: 18, flex: 1 },

    // CTA
    ctaBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 10, backgroundColor: c.text, borderRadius: 14,
      paddingVertical: 15,
    },
    ctaBtnText: { color: c.background, fontSize: 15, fontWeight: '700' },
  });
}
