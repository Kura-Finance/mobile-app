/**
 * TrackFiScreen
 *
 * Hub for financial tracking across three data sources.
 *
 * Security model:
 *   All three data sources (banking, brokers, on-chain) are behind a Passkey
 *   gate.  The user must authenticate with a platform passkey (Face ID / Touch
 *   ID) each session to unlock the in-memory Data Encryption Key (DEK).  The
 *   DEK is used by the backend to seal financial snapshots; without it the
 *   server will not return decrypted data.
 *
 *   Gate states:
 *     checking     → spinning while we query the backend
 *     unregistered → first-time setup CTA
 *     locked       → user must authenticate
 *     unlocking    → passkey dialog in progress
 *     unlocked     → hub + sub-screens are accessible (10 min TTL)
 *     error        → last attempt failed, retry available
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  BackHandler,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import DashboardScreen from '../dashboard/screens/DashboardScreen';
import InvestmentScreen from '../investment/screens/InvestmentScreen';
import DefiPortfolioScreen from './DefiPortfolioScreen';
import { useTrackFiDataKey } from '../hooks/useTrackFiDataKey';
import { useTrackFiBackgroundSync } from '../hooks/useTrackFiBackgroundSync';
import { useTrackFiHubBalances, type HubCardBalance } from '../hooks/useTrackFiHubBalances';
import { useInitializePlaidData } from '../../../shared/hooks/useInitializePlaidData';
import CurrencyDisplay from '../../../shared/components/CurrencyDisplay';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { features } from '../../../config/features';
import { useHeaderHeight } from '../../../shared/navigation/Header';

function useGateStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeGateStyles(colors), [colors]);
}
function useSubStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeSubStyles(colors), [colors]);
}
function useHubStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeHubStyles(colors), [colors]);
}

type SubView = 'banking' | 'brokers' | 'debank' | null;

interface NavCard {
  id: SubView & string;
  icon: string;
  accent: string;
  bg: string;
}

const NAV_CARDS: NavCard[] = [
  {
    id: 'banking',
    icon: 'business-outline',
    accent: '#6366F1',
    bg: 'rgba(99,102,241,0.10)',
  },
  {
    id: 'brokers',
    icon: 'bar-chart-outline',
    accent: '#10B981',
    bg: 'rgba(16,185,129,0.10)',
  },
  {
    id: 'debank',
    icon: 'git-network-outline',
    accent: '#F59E0B',
    bg: 'rgba(245,158,11,0.10)',
  },
];

const VISIBLE_NAV_CARDS = NAV_CARDS.filter(
  (card) => card.id !== 'debank' || features.debank,
);

/** Reserve space for the floating TabNavigator capsule at the bottom of Home. */
const TAB_BAR_CLEARANCE = 88;

// ─────────────────────────────────────────────────────────────────────────────
// Passkey Gate screens
// ─────────────────────────────────────────────────────────────────────────────

function PasskeyGateLayout({
  children,
  centerContent = false,
}: {
  children: React.ReactNode;
  centerContent?: boolean;
}) {
  const { colors } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: centerContent ? 'center' : 'flex-start',
        paddingTop: headerHeight + 8,
        paddingBottom: Math.max(insets.bottom, 12) + TAB_BAR_CLEARANCE,
        paddingHorizontal: 32,
        alignItems: 'center',
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: '100%', alignItems: 'center' }}>
        {children}
      </View>
    </ScrollView>
  );
}

interface PasskeyGateProps {
  state: ReturnType<typeof useTrackFiDataKey>['state'];
  errorMessage: string;
  isPasskeySupported: boolean;
  onUnlock: () => void;
  onRegister: () => void;
  onReportLostPasskey: () => void;
  onResetAndReregister: () => void;
}

function PasskeyGate({
  state,
  errorMessage,
  isPasskeySupported,
  onUnlock,
  onRegister,
  onReportLostPasskey,
  onResetAndReregister,
}: PasskeyGateProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const gate = useGateStyles();

  if (state === 'checking') {
    return (
      <PasskeyGateLayout centerContent>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={gate.statusText}>{t('trackfi.checkingSecurity')}</Text>
      </PasskeyGateLayout>
    );
  }

  if (state === 'unlocking') {
    return (
      <PasskeyGateLayout centerContent>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={gate.statusText}>{t('trackfi.waitingForPasskey')}</Text>
      </PasskeyGateLayout>
    );
  }

  if (state === 'resetting') {
    return (
      <PasskeyGateLayout centerContent>
        <ActivityIndicator size="large" color="#F59E0B" />
        <Text style={gate.statusText}>{t('trackfi.resettingSecurity')}</Text>
      </PasskeyGateLayout>
    );
  }

  if (state === 'unregistered') {
    return (
      <PasskeyGateLayout>
        <View style={gate.iconWrap}>
          <Ionicons name="finger-print" size={40} color="#6366F1" />
        </View>

        <Text style={gate.heading}>{t('trackfi.setupTitle')}</Text>
        <Text style={gate.body}>{t('trackfi.setupBody')}</Text>

        {!isPasskeySupported && (
          <View style={gate.warnBox}>
            <Ionicons name="warning-outline" size={16} color="#F59E0B" style={{ marginRight: 8 }} />
            <Text style={gate.warnText}>{t('trackfi.passkeyUnsupported')}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={onRegister}
          disabled={!isPasskeySupported}
          style={[gate.primaryBtn, !isPasskeySupported && { opacity: 0.4 }]}
        >
          <Ionicons name="finger-print" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={gate.primaryBtnText}>{t('trackfi.createPasskey')}</Text>
        </TouchableOpacity>

        <Text style={gate.hint}>{t('trackfi.setupHint')}</Text>
      </PasskeyGateLayout>
    );
  }

  // ── Lost passkey / new device ───────────────────────────────────────────────
  if (state === 'lost_passkey') {
    return (
      <PasskeyGateLayout>
        <View style={[gate.iconWrap, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)' }]}>
          <Ionicons name="phone-portrait-outline" size={40} color="#F59E0B" />
        </View>

        <Text style={gate.heading}>{t('trackfi.newDeviceTitle')}</Text>
        <Text style={gate.body}>{t('trackfi.newDeviceBody')}</Text>

        <View style={[gate.warnBox, { marginBottom: 24 }]}>
          <Ionicons name="warning-outline" size={16} color="#F59E0B" style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={[gate.warnText, { flex: 1 }]}>{t('trackfi.resetWarning')}</Text>
        </View>

        <TouchableOpacity onPress={onResetAndReregister} style={gate.dangerBtn}>
          <Ionicons name="refresh-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={gate.primaryBtnText}>{t('trackfi.resetAndSetup')}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onUnlock} style={gate.ghostBtn}>
          <Text style={gate.ghostBtnText}>{t('trackfi.tryPasskeyAgain')}</Text>
        </TouchableOpacity>
      </PasskeyGateLayout>
    );
  }

  // ── locked or error ─────────────────────────────────────────────────────────
  return (
    <PasskeyGateLayout>
      <View style={gate.iconWrap}>
        <Ionicons
          name={state === 'error' ? 'lock-open-outline' : 'lock-closed-outline'}
          size={40}
          color={state === 'error' ? '#EF4444' : '#6366F1'}
        />
      </View>

      <Text style={gate.heading}>{t('trackfi.title')}</Text>
      <Text style={gate.body}>
        {state === 'error' ? t('trackfi.authFailed') : t('trackfi.lockedBody')}
      </Text>

      <View style={gate.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color="#6366F1" style={{ marginRight: 8, marginTop: 1 }} />
        <Text style={gate.infoText}>{t('trackfi.prfRequirementNote')}</Text>
      </View>

      {errorMessage ? (
        <View style={gate.errorBox}>
          <Text style={gate.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <TouchableOpacity onPress={onUnlock} style={gate.primaryBtn}>
        <Ionicons name="finger-print" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={gate.primaryBtnText}>
          {state === 'error' ? t('trackfi.tryAgain') : t('trackfi.unlockWithPasskey')}
        </Text>
      </TouchableOpacity>

      <View style={gate.securityNote}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.textFaint} style={{ marginRight: 6 }} />
        <Text style={gate.hint}>{t('trackfi.dataEncryptedNote')}</Text>
      </View>

      <TouchableOpacity onPress={onReportLostPasskey} style={{ marginTop: 24 }}>
        <Text style={gate.lostPasskeyLink}>{t('trackfi.lostPasskeyLink')}</Text>
      </TouchableOpacity>
    </PasskeyGateLayout>
  );
}

function makeGateStyles(c: ThemeColors) {
  return StyleSheet.create({
    iconWrap: {
      width: 84,
      height: 84,
      borderRadius: 26,
      backgroundColor: 'rgba(99,102,241,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(99,102,241,0.2)',
      marginBottom: 28,
    },
    heading: {
      color: c.text,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
      marginBottom: 14,
      textAlign: 'center',
    },
    body: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 22,
      textAlign: 'center',
      marginBottom: 28,
    },
    primaryBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#6366F1',
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 28,
      width: '100%',
      marginBottom: 20,
      shadowColor: '#6366F1',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    primaryBtnText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    hint: {
      color: c.textFaint,
      fontSize: 12,
      textAlign: 'center',
      lineHeight: 18,
    },
    statusText: {
      color: c.textMuted,
      fontSize: 14,
      marginTop: 16,
    },
    errorBox: {
      backgroundColor: 'rgba(239,68,68,0.1)',
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.3)',
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 20,
      width: '100%',
    },
    errorText: {
      color: '#FCA5A5',
      fontSize: 13,
      textAlign: 'center',
    },
    warnBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: 'rgba(245,158,11,0.08)',
      borderRadius: 10,
      padding: 12,
      marginBottom: 20,
      width: '100%',
    },
    warnText: {
      color: '#FCD34D',
      fontSize: 12,
      flex: 1,
      lineHeight: 18,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: 'rgba(99,102,241,0.08)',
      borderRadius: 10,
      padding: 12,
      marginBottom: 20,
      width: '100%',
      borderWidth: 1,
      borderColor: 'rgba(99,102,241,0.2)',
    },
    infoText: {
      color: c.textMuted,
      fontSize: 12,
      flex: 1,
      lineHeight: 18,
    },
    securityNote: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#B45309',
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 28,
      width: '100%',
      marginBottom: 12,
      shadowColor: '#B45309',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    ghostBtn: {
      paddingVertical: 14,
      width: '100%',
      alignItems: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.borderStrong,
    },
    ghostBtnText: {
      color: c.textMuted,
      fontSize: 15,
      fontWeight: '600',
    },
    lostPasskeyLink: {
      color: c.textMuted,
      fontSize: 13,
      textDecorationLine: 'underline',
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-screen wrapper
// ─────────────────────────────────────────────────────────────────────────────

interface SubScreenProps {
  card: NavCard;
  onBack: () => void;
  onLock: () => void;
  unlockSeq: number;
}

/** Stable child — do not define inline or remounts wipe DeBank portfolio state. */
function SubScreenContent({
  cardId,
  unlockSeq,
}: {
  cardId: NavCard['id'];
  unlockSeq: number;
}) {
  switch (cardId) {
    case 'banking':
      return <DashboardScreen />;
    case 'brokers':
      return <InvestmentScreen category="Stock" unlockSeq={unlockSeq} />;
    case 'debank':
      return <DefiPortfolioScreen />;
    default:
      return null;
  }
}

function SubScreen({ card, onBack, onLock, unlockSeq }: SubScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const sub = useSubStyles();
  const headerHeight = useHeaderHeight();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[sub.header, { paddingTop: headerHeight + 8 }]}>
        <TouchableOpacity onPress={onBack} style={sub.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={[sub.iconBadge, { backgroundColor: card.bg }]}>
          <Ionicons name={card.icon as any} size={16} color={card.accent} />
        </View>
        <Text style={sub.title}>{t(`trackfi.hub.cards.${card.id}.title`)}</Text>
        <TouchableOpacity onPress={onLock} style={sub.lockBtn} activeOpacity={0.7}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1 }}>
        <SubScreenContent cardId={card.id} unlockSeq={unlockSeq} />
      </View>
    </View>
  );
}

function makeSubStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 12,
      backgroundColor: c.background,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 10,
    },
    backBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
    },
    lockBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center',
      marginLeft: 'auto',
    },
    iconBadge: {
      width: 32, height: 32, borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    title: {
      color: c.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Hub landing
// ─────────────────────────────────────────────────────────────────────────────

interface HubProps {
  onNavigate: (id: SubView & string) => void;
  onLock: () => void;
  ttlMs: number;
  balances: ReturnType<typeof useTrackFiHubBalances>;
}

function hubBalanceForCard(
  cardId: NavCard['id'],
  balances: ReturnType<typeof useTrackFiHubBalances>,
): HubCardBalance | null {
  switch (cardId) {
    case 'banking':
      return balances.banking;
    case 'brokers':
      return balances.brokers;
    case 'debank':
      return balances.defi;
    default:
      return null;
  }
}

function Hub({ onNavigate, onLock, ttlMs, balances }: HubProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const hub = useHubStyles();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const chevronColor = colors.textFaint;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{
        paddingTop: headerHeight + 8,
        paddingBottom: Math.max(insets.bottom, 12) + TAB_BAR_CLEARANCE,
        paddingHorizontal: 24,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={hub.headerRow}>
        <View>
          <Text style={hub.eyebrow}>{t('trackfi.hub.eyebrow')}</Text>
          <Text style={hub.heading}>{t('trackfi.title')}</Text>
        </View>
        <TouchableOpacity onPress={onLock} style={hub.lockWrap} activeOpacity={0.75}>
          <Ionicons name="lock-closed-outline" size={18} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Session indicator */}
      <View style={hub.sessionRow}>
        <Ionicons name="shield-checkmark-outline" size={13} color="#10B981" />
        <Text style={hub.sessionText}>
          {t('trackfi.hub.sessionStatus', { minutes: Math.ceil(ttlMs / 60_000) })}
        </Text>
      </View>

      <Text style={hub.subheading}>{t('trackfi.hub.subheading')}</Text>

      <View style={hub.cards}>
        {VISIBLE_NAV_CARDS.map((card, i) => {
          const balance = hubBalanceForCard(card.id, balances);
          const detailKey =
            card.id === 'debank' ? 'trackfi.hub.walletCount' : 'trackfi.hub.accountCount';

          return (
          <TouchableOpacity
            key={card.id}
            style={[hub.card, i === VISIBLE_NAV_CARDS.length - 1 && { marginBottom: 0 }]}
            onPress={() => onNavigate(card.id)}
            activeOpacity={0.75}
          >
            <View style={[hub.accentBar, { backgroundColor: card.accent }]} />
            <View style={[hub.cardIcon, { backgroundColor: card.bg }]}>
              <Ionicons name={card.icon as any} size={24} color={card.accent} />
            </View>
            <View style={hub.cardBody}>
              <View style={hub.cardHeaderRow}>
                <Text style={hub.cardTitle}>{t(`trackfi.hub.cards.${card.id}.title`)}</Text>
                {balance?.isLoading ? (
                  <ActivityIndicator size="small" color={card.accent} style={hub.balanceLoader} />
                ) : balance?.hasData ? (
                  <CurrencyDisplay
                    value={balance.total}
                    fontSize={18}
                    color={card.accent}
                    style={hub.cardBalance}
                  />
                ) : null}
              </View>
              <Text style={hub.cardSub}>{t(`trackfi.hub.cards.${card.id}.subtitle`)}</Text>
              {balance?.hasData && balance.detailCount > 0 ? (
                <Text style={hub.cardMeta}>
                  {t(detailKey, { count: balance.detailCount })}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={chevronColor} />
          </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function makeHubStyles(c: ThemeColors) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row', alignItems: 'flex-start',
      justifyContent: 'space-between', marginBottom: 8,
    },
    eyebrow: {
      color: '#6366F1', fontSize: 10, fontWeight: '700',
      letterSpacing: 1.5, marginBottom: 4,
    },
    heading: {
      color: c.text, fontSize: 34, fontWeight: '800', letterSpacing: -1,
    },
    lockWrap: {
      width: 42, height: 42, borderRadius: 14,
      backgroundColor: 'rgba(99,102,241,0.12)',
      alignItems: 'center', justifyContent: 'center', marginTop: 4,
    },
    sessionRow: {
      flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
    },
    sessionText: {
      color: '#10B981', fontSize: 12, fontWeight: '500',
    },
    subheading: {
      color: c.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 28,
    },
    cards: { gap: 14 },
    card: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: c.surfaceAlt, borderRadius: 18,
      padding: 18, borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border, gap: 14, overflow: 'hidden',
    },
    accentBar: {
      position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: 2,
    },
    cardIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    cardBody: { flex: 1, gap: 4, minWidth: 0 },
    cardHeaderRow: {
      flexDirection: 'row', alignItems: 'flex-start',
      justifyContent: 'space-between', gap: 12,
    },
    cardTitle: {
      flex: 1, color: c.text, fontSize: 17, fontWeight: '700', letterSpacing: -0.3,
    },
    cardBalance: { flexShrink: 0, fontWeight: '800', letterSpacing: -0.5 },
    balanceLoader: { flexShrink: 0 },
    cardMeta: { color: c.textFaint, fontSize: 11, fontWeight: '500' },
    cardSub: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export default function TrackFiScreen() {
  const [activeView, setActiveView] = useState<SubView>(null);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeView !== null) {
        setActiveView(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeView]);

  const {
    state, errorMessage, isPasskeySupported, ttlMs, unlockSeq,
    unlock, register, lock, reportLostPasskey, resetAndReregister,
  } = useTrackFiDataKey();

  useTrackFiBackgroundSync({
    enabled: state === 'unlocked',
    unlockSeq,
  });

  const hubBalances = useTrackFiHubBalances(state === 'unlocked');

  useInitializePlaidData(state === 'unlocked');

  const activeCard = activeView
    ? VISIBLE_NAV_CARDS.find((c) => c.id === activeView) ?? null
    : null;

  // ── Gate: show passkey UI until unlocked ───────────────────────────────────
  if (state !== 'unlocked') {
    return (
      <PasskeyGate
        state={state}
        errorMessage={errorMessage}
        isPasskeySupported={isPasskeySupported}
        onUnlock={unlock}
        onRegister={register}
        onReportLostPasskey={reportLostPasskey}
        onResetAndReregister={resetAndReregister}
      />
    );
  }

  // ── Unlocked: show sub-screen or hub ───────────────────────────────────────
  if (activeCard) {
    return (
      <SubScreen
        card={activeCard}
        onBack={() => setActiveView(null)}
        onLock={lock}
        unlockSeq={unlockSeq}
      />
    );
  }

  return (
    <Hub
      onNavigate={(id) => setActiveView(id)}
      onLock={lock}
      ttlMs={ttlMs}
      balances={hubBalances}
    />
  );
}
