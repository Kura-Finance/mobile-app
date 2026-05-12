/**
 * KuraCardScreen — Unified Card + Wallet view (Gnosis Pay)
 *
 * Layout (top → bottom):
 *   1. Total balance (Base USDC from Kura SCA)
 *   2. Quick Actions (Send · Receive)
 *   3. GP Virtual Card + onboarding wizard
 *   4. Transactions (Onchain — Base)
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { View as SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useHeaderStore } from '../../../shared/store/useHeaderStore';
import { useHeaderHeight } from '../../../shared/navigation/Header';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useKuraCardWallet } from '../context/KuraCardWalletContext';
import { useGnosisPayOnboarding } from '../hooks/useGnosisPayOnboarding';
import VirtualCard from '../components/VirtualCard';
import WalletHistorySection, { HOME_PREVIEW_LIMIT } from '../components/wallet/WalletHistorySection';
import WalletError from '../components/wallet/WalletError';
import ImportWalletScreen from './ImportWalletScreen';
import ReceiveModal from '../modals/ReceiveModal';
import SendModal from '../modals/send';
import GnosisPayOnboardingScreen from './GnosisPayOnboardingScreen';
import { CardApplyBanner } from '../components/StatusBanner';
import { features } from '../../../config/features';
import LoadingDots from '../../../shared/components/LoadingDots';
import { useHideBalance } from '../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../shared/utils/privacyDisplay';
function KuraCardScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const navigation = useNavigation<any>();
  const headerHeight = useHeaderHeight();
  const setScrolled = useHeaderStore((st) => st.setScrolled);
  // ── Modal / overlay state ─────────────────────────────────────────────────
  const [showImportWallet, setShowImportWallet] = useState(false);
  const [receiveMode, setReceiveMode] = useState<'topup' | 'receive'>('receive');
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const openReceive = useCallback(() => { setReceiveMode('receive'); setShowReceive(true); }, []);
  const openSend    = useCallback(() => setShowSend(true), []);

  const hideBalance = useHideBalance();

  // ── Kura wallet (Base USDC) ───────────────────────────────────────────────
  const {
    status: walletStatus,
    smartAddress,
    truncatedAddress,
    usdcBalance,
    errorMessage: walletError,
    isSending,
    isBridging,
    importWallet,
    sendUsdc,
    executeBridge,
    estimateUsdcGasReserve,
    estimateBridgeGasUsdc,
  } = useKuraCardWallet();

  // ── Gnosis Pay onboarding ─────────────────────────────────────────────────
  const { step: gpStep, card: gpCard, gpSafeAddress, isLoading: gpLoading } =
    useGnosisPayOnboarding();

  const gpComplete  = gpStep === 'complete';
  const walletReady = walletStatus === 'ready' && !!smartAddress;
  const balanceLoading = walletStatus !== 'ready';
  const gpInProgress = gpStep !== 'loading' && gpStep !== 'complete';

  useEffect(() => {
    if (gpInProgress) setShowOnboarding(true);
  }, [gpInProgress]);

  const handleApplyForCard = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  // ── Import screen overlay ─────────────────────────────────────────────────
  if (showImportWallet) {
    return (
      <SafeAreaView style={s.container}>
        <ImportWalletScreen
          onClose={() => setShowImportWallet(false)}
          onImport={importWallet}
        />
      </SafeAreaView>
    );
  }

  // ── Base wallet error ─────────────────────────────────────────────────────
  if (walletStatus === 'error') {
    return (
      <SafeAreaView style={s.container}>
        <WalletError
          message={walletError || t('card.couldNotSetUpWallet')}
          onRetry={() => setShowImportWallet(false)}
        />
      </SafeAreaView>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.content, { paddingTop: headerHeight + 8 }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
        >
          {/* ── 1. Balance (Base USDC) ───────────────────────────────────── */}
          <View style={s.balanceSection}>
            <Text style={s.balanceLabel}>{t('card.totalBalance')}</Text>
            <View style={s.balanceValueSlot}>
              {balanceLoading ? (
                <LoadingDots color={colors.text} size={10} />
              ) : hideBalance ? (
                <Text style={s.balanceAmount}>{HIDDEN_BALANCE_TEXT}</Text>
              ) : (
                <Text style={s.balanceAmount}>
                  ${usdcBalance.toFixed(2)}
                  <Text style={s.balanceCurrency}> USDC</Text>
                </Text>
              )}
            </View>
            {truncatedAddress ? (
              <Text style={s.addressText}>{truncatedAddress}</Text>
            ) : null}
          </View>

          {/* ── 2. Quick Actions ────────────────────────────────────────── */}
          <View style={s.quickActions}>
            <TouchableOpacity
              style={[s.pillBtn, !walletReady && s.pillBtnDisabled]}
              onPress={openSend}
              activeOpacity={0.8}
              disabled={!walletReady}
            >
              <Ionicons name="arrow-up-outline" size={18} color={colors.text} />
              <Text style={s.pillBtnText}>{t('card.send')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.pillBtn, s.pillBtnReceive, !walletReady && s.pillBtnDisabled]}
              onPress={openReceive}
              activeOpacity={0.8}
              disabled={!walletReady}
            >
              <Ionicons name="arrow-down-outline" size={18} color={colors.background} />
              <Text style={[s.pillBtnText, { color: colors.background }]}>{t('card.receive')}</Text>
            </TouchableOpacity>
          </View>

          {/* ── 3. GP Card, onboarding, or apply CTA ─────────────────────── */}
          {features.gnosisPay && (
            gpComplete && gpCard ? (
              <GpCardSection card={gpCard} safeAddress={gpSafeAddress} />
            ) : gpStep === 'loading' ? (
              <View style={s.cardLoading}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : showOnboarding ? (
              <View style={s.onboardingWrapper}>
                <GnosisPayOnboardingScreen onClose={() => setShowOnboarding(false)} />
              </View>
            ) : (
              <CardApplyBanner onApply={handleApplyForCard} isLoading={gpLoading} />
            )
          )}

          {/* ── 4. Transactions ──────────────────────────────────────────── */}
          <View style={s.txSection}>
            {walletReady ? (
              <WalletHistorySection
                smartAddress={smartAddress}
                sectionTitleStyle={s.sectionTitle}
                previewLimit={HOME_PREVIEW_LIMIT}
                onViewAll={() => navigation.navigate('WalletTransactions', { smartAddress })}
              />
            ) : (
              <View style={s.emptyTxn}>
                <Ionicons name="receipt-outline" size={32} color={colors.textFaint} />
                <Text style={s.emptyTxnText}>{t('card.noTransactionsYet')}</Text>
                <Text style={s.emptyTxnSub}>{t('card.sendOrReceiveToStart')}</Text>
              </View>
            )}
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        <ReceiveModal
          visible={showReceive}
          onClose={() => setShowReceive(false)}
          smartAddress={smartAddress}
          mode={receiveMode}
        />
        <SendModal
          visible={showSend}
          onClose={() => setShowSend(false)}
          smartAddress={smartAddress}
          usdcBalance={usdcBalance}
          isSending={isSending}
          isBridging={isBridging}
          onSend={sendUsdc}
          onBridge={executeBridge}
          estimateGasReserve={estimateUsdcGasReserve}
          estimateBridgeGasUsdc={estimateBridgeGasUsdc}
        />
    </SafeAreaView>
  );
}

export default KuraCardScreen;

// ─────────────────────────────────────────────────────────────────────────────
// GP card detail section (shown after onboarding complete)
// ─────────────────────────────────────────────────────────────────────────────

import type { GpVirtualCard } from '../../../lib/api/gp';
import { freezeGpCard, unfreezeGpCard } from '../../../lib/api/gp';

function GpCardSection({
  card,
  safeAddress,
}: {
  card: GpVirtualCard;
  safeAddress: string | null;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [frozen, setFrozen] = useState(card.status === 'frozen');
  const [toggling, setToggling] = useState(false);

  const toggleFreeze = async () => {
    setToggling(true);
    try {
      if (frozen) {
        await unfreezeGpCard(card.id);
        setFrozen(false);
      } else {
        await freezeGpCard(card.id);
        setFrozen(true);
      }
    } catch {
      // silently ignore; user can retry
    } finally {
      setToggling(false);
    }
  };

  return (
    <View style={s.gpCardSection}>
      {/* Card face */}
      <VirtualCard
        balance={t('card.cardFaceLabel', { last4: card.last4 })}
        masked
      />

      {/* Status pill */}
      <View style={[s.gpStatus, frozen && s.gpStatusFrozen]}>
        <View style={[s.gpDot, frozen && s.gpDotFrozen]} />
        <Text style={[s.gpStatusText, frozen && s.gpStatusTextFrozen]}>
          {frozen ? t('card.cardFrozen') : t('card.cardActive', { last4: card.last4 })}
        </Text>
        <TouchableOpacity
          onPress={toggleFreeze}
          disabled={toggling}
          style={s.gpFreezeBtn}
        >
          {toggling
            ? <ActivityIndicator size="small" color="#6366F1" />
            : <Ionicons name={frozen ? 'flash-outline' : 'snow-outline'} size={14} color="#6366F1" />}
        </TouchableOpacity>
      </View>

      {safeAddress && (
        <View style={s.safeRow}>
          <Text style={s.safeLabel}>{t('card.onChainWallet')}</Text>
          <Text style={s.safeAddr} numberOfLines={1} ellipsizeMode="middle">
            {safeAddress}
          </Text>
        </View>
      )}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: 20, paddingTop: 0 },

    // Balance
    balanceSection: { alignItems: 'center', paddingTop: 8, paddingBottom: 16 },
    balanceLabel: { color: c.textFaint, fontSize: 13, fontWeight: '500', marginBottom: 6 },
    balanceValueSlot: {
      minHeight: 46,
      alignItems: 'center',
      justifyContent: 'center',
    },
    balanceAmount: { color: c.text, fontSize: 38, fontWeight: '800', letterSpacing: -1 },
    balanceCurrency: { fontSize: 18, fontWeight: '500', color: c.textMuted },
    addressText: { color: c.textFaint, fontSize: 11, fontFamily: 'monospace', marginTop: 6 },

    // Quick actions
    pillBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 8, backgroundColor: c.surface, borderRadius: 28, paddingVertical: 14,
      borderWidth: 1, borderColor: c.borderStrong,
    },
    pillBtnReceive: { backgroundColor: c.text, borderColor: c.text },
    pillBtnDisabled: { opacity: 0.45 },
    pillBtnText: { color: c.text, fontSize: 16, fontWeight: '600' },
    quickActions: { flexDirection: 'row', gap: 12, marginTop: 0, marginBottom: 16 },

    cardLoading: { alignItems: 'center', paddingVertical: 32, marginBottom: 20 },

    // GP onboarding embed
    onboardingWrapper: {
      marginBottom: 20, borderRadius: 16, overflow: 'hidden',
      borderWidth: 1, borderColor: c.primarySoft,
    },

    // GP card section (after complete)
    gpCardSection: { marginBottom: 16, gap: 10 },
    gpStatus: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 10,
      paddingVertical: 9, paddingHorizontal: 14,
      borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    },
    gpStatusFrozen: {
      backgroundColor: 'rgba(99,102,241,0.08)',
      borderColor: 'rgba(99,102,241,0.2)',
    },
    gpDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10B981' },
    gpDotFrozen: { backgroundColor: '#6366F1' },
    gpStatusText: { flex: 1, color: '#10B981', fontSize: 12, fontWeight: '500' },
    gpStatusTextFrozen: { color: '#6366F1' },
    gpFreezeBtn: { padding: 4 },
    safeRow: {
      backgroundColor: c.surface, borderRadius: 10, padding: 10, gap: 3,
      borderWidth: 1, borderColor: c.border,
    },
    safeLabel: { color: c.textFaint, fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
    safeAddr: { color: c.textMuted, fontSize: 11, fontFamily: 'monospace' },

    // Transactions
    txSection: { marginBottom: 8 },
    sectionTitle: {
      color: c.textMuted, fontSize: 12, fontWeight: '700',
      textTransform: 'uppercase', letterSpacing: 0.5,
    },
    emptyTxn: { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyTxnText: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
    emptyTxnSub: { color: c.textFaint, fontSize: 12 },
  });
}
