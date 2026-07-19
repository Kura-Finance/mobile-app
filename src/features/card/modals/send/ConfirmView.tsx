import LoadingDots from '../../../../shared/components/LoadingDots';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Animated,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  BridgeChain,
  LiFiBridgeQuote,
  BASE_CHAIN_ID,
  fetchBridgeQuote,
  formatBridgeReceive,
  bridgeFeeUsdTotal,
  formatBridgeTime,
  hasBridgeFee,
} from '../../../../lib/api/bridge/lifiClient';
import { CryptoContact, ChainOption, ALL_CHAINS, BASE_CHAIN } from '../../hooks/useCryptoContacts';
import { PAY_GAS_IN_USDC } from '../../config/cardWalletConfig';
import { makeModalStyles } from '../modalStyles';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import InlineErrorBanner from '../../../../shared/components/InlineErrorBanner';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useLocalAuthGate } from '../../../../shared/hooks/useLocalAuthGate';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfirmParams {
  contact: CryptoContact;
  chain: ChainOption;
  amount: number;
  smartAddress: string;
}

interface Props extends ConfirmParams {
  isSending: boolean;
  isBridging: boolean;
  onSend: (toAddress: string, amount: number) => Promise<string>;
  onBridge: (quote: LiFiBridgeQuote) => Promise<string>;
  /** Estimate the actual USDC gas cost for a bridge route (0 when sponsored). */
  estimateBridgeGasUsdc: (quote: LiFiBridgeQuote) => Promise<number>;
  /** Estimate USDC gas for a direct Base send (0 when sponsored). */
  estimateGasReserve: () => Promise<number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const REFRESH_SEC = 5;

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmView
// ─────────────────────────────────────────────────────────────────────────────

export default function ConfirmView({
  contact, chain, amount, smartAddress,
  isSending, isBridging, onSend, onBridge, estimateBridgeGasUsdc, estimateGasReserve,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const { requireLocalAuth } = useLocalAuthGate();
  const s = useMemo(() => makeModalStyles(colors), [colors]);
  const st = useStyles();
  const isBridge = chain.key !== 'BASE';
  const isWorking = isSending || isBridging;

  // ── Quote state (bridge only) ─────────────────────────────────────────────
  const [quote, setQuote] = useState<LiFiBridgeQuote | null>(null);
  const [quoteError, setQuoteError] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_SEC);
  const [gasUsdc, setGasUsdc] = useState<number | null>(null);
  const [baseGasUsdc, setBaseGasUsdc] = useState<number | null>(null);
  const countdownRef = useRef(REFRESH_SEC);

  // ── Result state ──────────────────────────────────────────────────────────
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [bridgeTxChain, setBridgeTxChain] = useState('');

  // ── Progress bar animation (0 → 1 over REFRESH_SEC) ──────────────────────
  const progressAnim = useRef(new Animated.Value(1)).current;

  const animateProgress = useCallback(() => {
    progressAnim.setValue(1);
    Animated.timing(progressAnim, {
      toValue: 0,
      duration: REFRESH_SEC * 1000,
      useNativeDriver: false,
    }).start();
  }, [progressAnim]);

  // ── Fetch quote ───────────────────────────────────────────────────────────
  const doFetchQuote = useCallback(async () => {
    if (!isBridge) return;
    setIsFetching(true);
    setQuoteError('');
    try {
      const q = await fetchBridgeQuote({
        fromChainId: BASE_CHAIN_ID,
        toChainId: (chain as BridgeChain).id,
        fromAmountWei: String(Math.round(amount * 1_000_000)),
        fromAddress: smartAddress,
        toAddress: contact.address,
      });
      setQuote(q);
      countdownRef.current = REFRESH_SEC;
      setCountdown(REFRESH_SEC);
      animateProgress();
      // Price the actual network fee (paid in USDC) for this exact route.
      if (PAY_GAS_IN_USDC) {
        setGasUsdc(null);
        estimateBridgeGasUsdc(q).then(setGasUsdc).catch(() => setGasUsdc(null));
      }
    } catch (err) {
      setQuoteError(err instanceof Error ? err.message : t('card.failedGetQuote'));
    } finally {
      setIsFetching(false);
    }
  }, [isBridge, chain, amount, smartAddress, contact.address, animateProgress, estimateBridgeGasUsdc, t]);

  // ── Auto-refresh every REFRESH_SEC ───────────────────────────────────────
  useEffect(() => {
    if (!isBridge) return;
    doFetchQuote();

    const tick = setInterval(() => {
      countdownRef.current -= 1;
      setCountdown(countdownRef.current);
      if (countdownRef.current <= 0) {
        countdownRef.current = REFRESH_SEC;
        doFetchQuote();
      }
    }, 1000);

    return () => clearInterval(tick);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // ── Base send gas estimate ──────────────────────────────────────────────────
  useEffect(() => {
    if (isBridge) return;
    if (!PAY_GAS_IN_USDC) {
      setBaseGasUsdc(null);
      return;
    }
    let alive = true;
    setBaseGasUsdc(null);
    estimateGasReserve()
      .then((r) => { if (alive) setBaseGasUsdc(r); })
      .catch(() => { if (alive) setBaseGasUsdc(null); });
    return () => { alive = false; };
  }, [isBridge, estimateGasReserve]);

  const renderGasFeeValue = (gas: number | null) => {
    if (!PAY_GAS_IN_USDC) {
      return { value: t('card.sponsored'), valueStyle: st.sponsoredText };
    }
    if (gas != null) {
      return { value: t('card.gasUsdcValue', { gas: money.value(gas) }) };
    }
    return { value: t('card.estimatingGas') };
  };

  // ── Execute ───────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(async () => {
    setError('');
    const gate = await requireLocalAuth('card.biometricSendPrompt');
    if (!gate.allowed) {
      if (gate.message) setError(gate.message);
      return;
    }
    try {
      if (isBridge) {
        if (!quote) return;
        const hash = await onBridge(quote);
        setBridgeTxChain((chain as BridgeChain).name);
        setTxHash(hash);
      } else {
        const hash = await onSend(contact.address, amount);
        setTxHash(hash);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('card.transactionFailed'));
    }
  }, [isBridge, quote, onBridge, onSend, contact.address, amount, chain, requireLocalAuth, t]);

  const contactChain = ALL_CHAINS.find((c) => c.key === contact.chainKey) ?? BASE_CHAIN;

  // ─────────────────────────────────────────────────────────────────────────
  // Success state
  // ─────────────────────────────────────────────────────────────────────────
  if (txHash) {
    return (
      <ScrollView style={st.scroll} contentContainerStyle={st.content}>
        <View style={s.successBox}>
          <View style={s.successIcon}>
            <Ionicons name="checkmark-circle" size={52} color="#10B981" />
          </View>
          <Text style={s.successTitle}>{bridgeTxChain ? t('card.bridgeInitiated') : t('card.sentTitle')}</Text>
          <Text style={s.successSub}>
            {bridgeTxChain
              ? t('card.bridgingSub', { chain: bridgeTxChain, time: quote ? formatBridgeTime(quote) : t('card.twoMin') })
              : t('card.sentSub', { amount, name: contact.name })}
          </Text>
          <TouchableOpacity
            onPress={() => Clipboard.setStringAsync(txHash).catch(() => undefined)}
            style={s.txHashBox}
          >
            <Text style={s.txHashLabel}>{t('card.txHash')}</Text>
            <Text style={s.txHashValue} numberOfLines={1} ellipsizeMode="middle">{txHash}</Text>
            <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Confirm state
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={st.scroll}
      contentContainerStyle={[st.content, { paddingBottom: 80 }]}
      keyboardShouldPersistTaps="handled"
    >
      {/* ── Recipient ── */}
      <View style={[st.recipientCard, { borderLeftColor: contactChain.color }]}>
        <View style={[st.recipientIcon, { backgroundColor: `${contactChain.color}22` }]}>
          <Ionicons name="wallet-outline" size={22} color={contactChain.color} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={st.recipientName}>{contact.name}</Text>
          <Text style={st.recipientAddr} numberOfLines={1} ellipsizeMode="middle">
            {contact.address}
          </Text>
        </View>
      </View>

      {/* ── You send ── */}
      <View style={st.summaryBox}>
        <Row label={t('card.youSend')} value={`${amount} USDC`} valueStyle={st.amountValue} />
        <Row label={t('card.network')} value={chain.name} dot={chain.color} />

        {isBridge && (
          <>
            <View style={st.divider} />

            {isFetching && !quote ? (
              <View style={st.fetchingRow}>
                <LoadingDots compact color={colors.textMuted} size={6}    />
                <Text style={st.fetchingText}>{t('card.gettingBestRate')}</Text>
              </View>
            ) : quoteError ? (
              <InlineErrorBanner message={quoteError} style={{ marginTop: 8 }} />
            ) : quote ? (
              <>
                <Row
                  label={t('card.youReceive')}
                  value={`${formatBridgeReceive(quote)} USDC`}
                  valueStyle={st.receiveValue}
                />
                <Row label={t('card.gasFee')} {...renderGasFeeValue(gasUsdc)} />
                {hasBridgeFee(quote) ? (
                  <Row
                    label={t('card.bridgeFee')}
                    value={money.price(bridgeFeeUsdTotal(quote))}
                  />
                ) : null}
                <Row
                  label={t('card.via')}
                  value={quote.tools.filter((tool) => tool !== 'feeCollection').join(', ') || 'Li.Fi'}
                  valueStyle={{ textTransform: 'capitalize' }}
                />
                <Row label={t('card.estTime')} value={formatBridgeTime(quote)} />
              </>
            ) : null}
          </>
        )}

        {!isBridge && (
          <>
            <View style={st.divider} />
            <Row label={t('card.gasFee')} {...renderGasFeeValue(baseGasUsdc)} />
            <Row label={t('card.arrives')} value={t('card.twoSeconds')} />
          </>
        )}
      </View>

      {/* ── Rate refresh bar (bridge only) ── */}
      {isBridge && quote && !isFetching && (
        <View style={st.refreshBar}>
          <Animated.View
            style={[
              st.refreshProgress,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
          <View style={st.refreshLabel}>
            <Ionicons name="refresh-outline" size={12} color={colors.textMuted} />
            <Text style={st.refreshText}>
              {t('card.rateRefreshesIn', { seconds: countdown })}
            </Text>
          </View>
        </View>
      )}

      {error ? <InlineErrorBanner message={error} style={{ marginTop: 8 }} /> : null}

      {/* ── Confirm button ── */}
      <TouchableOpacity
        onPress={handleConfirm}
        disabled={isWorking || (isBridge && !quote)}
        style={[st.confirmBtn, (isWorking || (isBridge && !quote)) && st.confirmBtnDisabled]}
        activeOpacity={0.85}
      >
        {isWorking ? (
          <LoadingDots compact color="#FFF" size={6}    />
        ) : (
          <Ionicons name={isBridge ? 'git-branch-outline' : 'arrow-up-outline'} size={18} color="#FFF" />
        )}
        <Text style={st.confirmBtnText}>
          {isWorking
            ? isBridge ? t('card.bridging') : t('card.sending')
            : isBridge ? t('card.confirmBridgeTo', { chain: chain.name }) : t('card.confirmSend')}
        </Text>
      </TouchableOpacity>

      <Text style={s.networkNote}>
        {isBridge
          ? t('card.bridgeRateNote')
          : PAY_GAS_IN_USDC ? t('card.gasUsdcNote') : t('card.gasSponsoredNote')}
      </Text>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Row helper
// ─────────────────────────────────────────────────────────────────────────────

function Row({
  label, value, valueStyle, dot,
}: {
  label: string;
  value: string;
  valueStyle?: object;
  dot?: string;
}) {
  const st = useStyles();
  return (
    <View style={st.row}>
      <Text style={st.rowLabel}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {dot && <View style={[st.rowDot, { backgroundColor: dot }]} />}
        <Text style={[st.rowValue, valueStyle]}>{value}</Text>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: c.backgroundElevated,
    },
    content: {
      paddingHorizontal: 24,
      paddingTop: 12,
      paddingBottom: 48,
    },

    // Recipient
    recipientCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderLeftWidth: 3,
      borderColor: c.borderStrong,
      padding: 14,
      marginBottom: 16,
    },
    recipientIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    recipientName: { color: c.text, fontSize: 15, fontWeight: '600', marginBottom: 3 },
    recipientAddr: {
      color: c.textMuted,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },

    // Summary box
    summaryBox: {
      backgroundColor: c.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.borderStrong,
      padding: 16,
      gap: 12,
      marginBottom: 12,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    rowLabel: { color: c.textMuted, fontSize: 14 },
    rowValue: { color: c.text, fontSize: 14, fontWeight: '500' },
    rowDot: { width: 8, height: 8, borderRadius: 4 },
    amountValue: { color: c.text, fontSize: 16, fontWeight: '700' },
    receiveValue: { color: '#10B981', fontSize: 15, fontWeight: '700' },
    sponsoredText: { color: '#10B981', fontWeight: '600' },
    divider: { height: 1, backgroundColor: c.borderStrong },

    // Fetching
    fetchingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 4,
    },
    fetchingText: { color: c.textMuted, fontSize: 13 },

    // Refresh bar
    refreshBar: {
      height: 28,
      backgroundColor: c.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.borderStrong,
      overflow: 'hidden',
      marginBottom: 16,
      justifyContent: 'center',
    },
    refreshProgress: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      backgroundColor: 'rgba(139,92,246,0.15)',
      borderRadius: 8,
    },
    refreshLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
    },
    refreshText: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '500',
    },

    // Confirm button
    confirmBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: c.primary,
      borderRadius: 14,
      paddingVertical: 16,
      marginTop: 4,
      marginBottom: 12,
    },
    confirmBtnDisabled: {
      backgroundColor: c.surfaceInput,
    },
    confirmBtnText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '700',
    },
  });
}
