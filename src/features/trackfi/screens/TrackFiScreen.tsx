import LoadingDots from '../../../shared/components/LoadingDots';
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

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
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
import TrackFiDashboard from '../components/dashboard/TrackFiDashboard';
import { useTrackFiBackgroundSync } from '../hooks/useTrackFiBackgroundSync';
import { useInitializePlaidData } from '../../../shared/hooks/useInitializePlaidData';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { features } from '../../../config/features';
import { useHeaderHeight } from '../../../shared/navigation/Header';
import { useHeaderStore } from '../../../shared/store/useHeaderStore';
import {
  setTrackFiHeaderHandlers,
} from '../navigation/trackFiHeaderHandlers';
import { useTabNavigator } from '../../../shared/navigation/TabNavigatorContext';

function useGateStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeGateStyles(colors), [colors]);
}

function useTrackFiToolbar(
  activeView: SubView,
  onBack: () => void,
  onLock: () => void,
  enabled: boolean,
) {
  const setTrackFiToolbar = useHeaderStore((s) => s.setTrackFiToolbar);

  useEffect(() => {
    if (!enabled) {
      setTrackFiToolbar(null);
      setTrackFiHeaderHandlers(null);
      return;
    }

    setTrackFiToolbar({ showBack: activeView !== null });
    setTrackFiHeaderHandlers({
      onBack: activeView !== null ? onBack : undefined,
      onLock,
    });

    return () => {
      setTrackFiToolbar(null);
      setTrackFiHeaderHandlers(null);
    };
  }, [enabled, activeView, onBack, onLock, setTrackFiToolbar]);
}

type SubView = 'banking' | 'brokers' | 'debank' | null;

/** Reserve space for the floating TabNavigator capsule at the bottom. */
const TAB_BAR_CLEARANCE = 120;

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
        <LoadingDots color={colors.primary} size={10}    />
        <Text style={gate.statusText}>{t('trackfi.checkingSecurity')}</Text>
      </PasskeyGateLayout>
    );
  }

  if (state === 'unlocking') {
    return (
      <PasskeyGateLayout centerContent>
        <LoadingDots color={colors.primary} size={10}    />
        <Text style={gate.statusText}>{t('trackfi.waitingForPasskey')}</Text>
      </PasskeyGateLayout>
    );
  }

  if (state === 'resetting') {
    return (
      <PasskeyGateLayout centerContent>
        <LoadingDots color={colors.warning} size={10}    />
        <Text style={gate.statusText}>{t('trackfi.resettingSecurity')}</Text>
      </PasskeyGateLayout>
    );
  }

  if (state === 'unregistered') {
    return (
      <PasskeyGateLayout>
        <View style={gate.iconWrap}>
          <Ionicons name="finger-print" size={40} color={colors.primary} />
        </View>

        <Text style={gate.heading}>{t('trackfi.setupTitle')}</Text>
        <Text style={gate.body}>{t('trackfi.setupBody')}</Text>

        {!isPasskeySupported && (
          <View style={gate.warnBox}>
            <Ionicons name="warning-outline" size={16} color={colors.warning} style={{ marginRight: 8 }} />
            <Text style={gate.warnText}>{t('trackfi.passkeyUnsupported')}</Text>
          </View>
        )}

        <TouchableOpacity
          onPress={onRegister}
          disabled={!isPasskeySupported}
          style={[gate.primaryBtn, !isPasskeySupported && { opacity: 0.4 }]}
        >
          <Ionicons name="finger-print" size={20} color={colors.textInverse} style={{ marginRight: 8 }} />
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
        <View style={[gate.iconWrap, gate.iconWrapWarning]}>
          <Ionicons name="phone-portrait-outline" size={40} color={colors.warning} />
        </View>

        <Text style={gate.heading}>{t('trackfi.newDeviceTitle')}</Text>
        <Text style={gate.body}>{t('trackfi.newDeviceBody')}</Text>

        <View style={[gate.warnBox, { marginBottom: 24 }]}>
          <Ionicons name="warning-outline" size={16} color={colors.warning} style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={[gate.warnText, { flex: 1 }]}>{t('trackfi.resetWarning')}</Text>
        </View>

        <TouchableOpacity onPress={onResetAndReregister} style={gate.dangerBtn}>
          <Ionicons name="refresh-outline" size={20} color={colors.textInverse} style={{ marginRight: 8 }} />
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
          color={state === 'error' ? colors.danger : colors.primary}
        />
      </View>

      <Text style={gate.heading}>{t('trackfi.title')}</Text>
      <Text style={gate.body}>
        {state === 'error' ? t('trackfi.authFailed') : t('trackfi.lockedBody')}
      </Text>

      <View style={gate.infoBox}>
        <Ionicons name="information-circle-outline" size={16} color={colors.primary} style={{ marginRight: 8, marginTop: 1 }} />
        <Text style={gate.infoText}>{t('trackfi.prfRequirementNote')}</Text>
      </View>

      {errorMessage ? (
        <View style={gate.errorBox}>
          <Text style={gate.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      <TouchableOpacity onPress={onUnlock} style={gate.primaryBtn}>
        <Ionicons name="finger-print" size={20} color={colors.textInverse} style={{ marginRight: 8 }} />
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
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: c.border,
      marginBottom: 28,
    },
    iconWrapWarning: {
      backgroundColor: `${c.warning}18`,
      borderColor: `${c.warning}40`,
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
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 28,
      width: '100%',
      marginBottom: 20,
      shadowColor: c.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
    },
    primaryBtnText: {
      color: c.textInverse,
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
      backgroundColor: `${c.danger}18`,
      borderWidth: 1,
      borderColor: `${c.danger}40`,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 20,
      width: '100%',
    },
    errorText: {
      color: c.danger,
      fontSize: 13,
      textAlign: 'center',
    },
    warnBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: `${c.warning}14`,
      borderRadius: 10,
      padding: 12,
      marginBottom: 20,
      width: '100%',
    },
    warnText: {
      color: c.warning,
      fontSize: 12,
      flex: 1,
      lineHeight: 18,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: c.primarySoft,
      borderRadius: 10,
      padding: 12,
      marginBottom: 20,
      width: '100%',
      borderWidth: 1,
      borderColor: c.border,
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
      backgroundColor: c.warning,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 28,
      width: '100%',
      marginBottom: 12,
      shadowColor: c.warning,
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
  unlockSeq: number;
  cardId: 'banking' | 'brokers' | 'debank';
}

/** Stable child — do not define inline or remounts wipe DeBank portfolio state. */
function SubScreenContent({
  cardId,
  unlockSeq,
}: {
  cardId: SubScreenProps['cardId'];
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

function SubScreen({ cardId, unlockSeq }: { cardId: SubScreenProps['cardId']; unlockSeq: number }) {
  const { colors } = useTheme();
  const headerHeight = useHeaderHeight();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: headerHeight + 8 }}>
      <SubScreenContent cardId={cardId} unlockSeq={unlockSeq} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export default function TrackFiScreen() {
  const { t } = useTranslation();
  const { activeTab } = useTabNavigator();
  const [activeView, setActiveView] = useState<SubView>(null);
  const setHeaderContent = useHeaderStore((s) => s.setHeaderContent);
  const setScrolled = useHeaderStore((s) => s.setScrolled);
  const isTrackFiTabActive = activeTab === 'TrackFi';

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (activeView !== null) {
        setActiveView(null);
        setScrolled(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeView, setScrolled]);

  const {
    state, errorMessage, isPasskeySupported, unlockSeq,
    unlock, register, lock, reportLostPasskey, resetAndReregister,
  } = useTrackFiDataKey();

  useEffect(() => {
    if (state !== 'unlocked' || !isTrackFiTabActive) return;
    if (activeView) {
      setHeaderContent(
        t(`trackfi.hub.cards.${activeView}.title`),
        t(`trackfi.hub.cards.${activeView}.subtitle`),
      );
    } else {
      setHeaderContent(t('nav.trackFi'), t('trackfi.hub.subheading'));
    }
  }, [activeView, state, isTrackFiTabActive, setHeaderContent, t]);

  useTrackFiBackgroundSync({
    enabled: state === 'unlocked',
    unlockSeq,
  });

  useInitializePlaidData(state === 'unlocked', unlockSeq);

  const handleBack = useCallback(() => {
    setActiveView(null);
    setScrolled(false);
  }, [setScrolled]);

  const handleNavigate = (id: 'banking' | 'brokers' | 'debank') => {
    setScrolled(false);
    setActiveView(id);
  };

  useTrackFiToolbar(activeView, handleBack, lock, state === 'unlocked' && isTrackFiTabActive);

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
  if (activeView && (activeView !== 'debank' || features.debank)) {
    return (
      <SubScreen
        cardId={activeView}
        unlockSeq={unlockSeq}
      />
    );
  }

  return (
    <TrackFiDashboard onNavigate={handleNavigate} />
  );
}
