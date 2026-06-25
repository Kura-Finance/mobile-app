import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import {
  BridgeChain,
  BASE_CHAIN_ID,
  fetchBridgeQuote,
  type LiFiBridgeQuote,
} from '../../../../lib/api/bridge/lifiClient';
import { CryptoContact, ChainOption, ALL_CHAINS, BASE_CHAIN } from '../../hooks/useCryptoContacts';
import { PAY_GAS_IN_USDC } from '../../config/cardWalletConfig';
import { makeModalStyles } from '../modalStyles';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import ChainPickerSheet from './ChainPickerSheet';
import InlineErrorBanner from '../../../../shared/components/InlineErrorBanner';

const BRIDGE_GAS_PROBE_USDC = 1;

interface Props {
  contact: CryptoContact;
  initialChain: ChainOption;
  smartAddress: string;
  usdcBalance: number;
  onContinue: (amount: number, chain: ChainOption) => void;
  /** Estimate USDC to reserve for network fees (0 when gas is sponsored). */
  estimateGasReserve: () => Promise<number>;
  /** Estimate the actual USDC gas cost for a bridge route (0 when sponsored). */
  estimateBridgeGasUsdc: (quote: LiFiBridgeQuote) => Promise<number>;
}

export default function SendView({
  contact,
  initialChain,
  smartAddress,
  usdcBalance,
  onContinue,
  estimateGasReserve,
  estimateBridgeGasUsdc,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeModalStyles(colors), [colors]);
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [chain, setChain] = useState<ChainOption>(initialChain);
  const [amountStr, setAmountStr] = useState('');
  const [error, setError] = useState('');
  const [showChainPicker, setShowChainPicker] = useState(false);
  const [gasReserve, setGasReserve] = useState(0);
  const [gasEstimating, setGasEstimating] = useState(false);

  const isBridge = chain.key !== 'BASE';
  const contactChain = ALL_CHAINS.find((c) => c.key === contact.chainKey) ?? BASE_CHAIN;

  // USDC that can actually be sent once the network fee (paid in USDC) is held
  // back. In sponsored mode the reserve is 0 and this equals the full balance.
  const maxSendable = Math.max(0, usdcBalance - gasReserve);
  const showGas = PAY_GAS_IN_USDC;
  const gasBlocked = showGas && !gasEstimating && maxSendable <= 0;

  useEffect(() => {
    if (!showGas || isBridge) return;
    let alive = true;
    setGasEstimating(true);
    estimateGasReserve()
      .then((r) => { if (alive) setGasReserve(r); })
      .catch(() => { if (alive) setGasReserve(0); })
      .finally(() => { if (alive) setGasEstimating(false); });
    return () => { alive = false; };
  }, [showGas, isBridge, estimateGasReserve]);

  useEffect(() => {
    if (!showGas || !isBridge || !smartAddress) return;

    const parsed = parseFloat(amountStr);
    const quoteAmount = !Number.isNaN(parsed) && parsed > 0 ? parsed : BRIDGE_GAS_PROBE_USDC;
    let alive = true;

    const timer = setTimeout(() => {
      setGasEstimating(true);
      void fetchBridgeQuote({
        fromChainId: BASE_CHAIN_ID,
        toChainId: (chain as BridgeChain).id,
        fromAmountWei: String(Math.round(quoteAmount * 1_000_000)),
        fromAddress: smartAddress,
        toAddress: contact.address,
      })
        .then((quote) => estimateBridgeGasUsdc(quote))
        .then((r) => { if (alive) setGasReserve(r); })
        .catch(() => { if (alive) setGasReserve(0); })
        .finally(() => { if (alive) setGasEstimating(false); });
    }, amountStr.trim() ? 400 : 0);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [showGas, isBridge, chain, smartAddress, contact.address, amountStr, estimateBridgeGasUsdc]);

  const handleContinue = () => {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) { setError(t('card.enterValidAmount')); return; }
    if (amount > usdcBalance) { setError(t('card.insufficientUsdcBalance')); return; }
    if (amount > maxSendable) { setError(t('card.amountLeaveGas')); return; }
    setError('');
    onContinue(amount, chain);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <ScrollView
          style={st.scroll}
          contentContainerStyle={st.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Recipient card */}
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

          {/* Amount */}
          <View style={s.amountHeader}>
            <Text style={s.fieldLabel}>{t('card.amountUsdc')}</Text>
            <TouchableOpacity
              onPress={() => { setAmountStr(maxSendable.toFixed(6)); setError(''); }}
              disabled={gasBlocked}
            >
              <Text style={[s.maxBtn, gasBlocked && { opacity: 0.4 }]}>
                {t('card.maxWithAmount', { amount: maxSendable.toFixed(2) })}
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={s.input}
            placeholder="0.00"
            placeholderTextColor={colors.textFaint}
            value={amountStr}
            onChangeText={(v) => { setAmountStr(v); setError(''); }}
            keyboardType="decimal-pad"
          />

          {/* Destination network */}
          <Text style={[s.fieldLabel, { marginTop: 4 }]}>{t('card.destinationNetwork')}</Text>
          <TouchableOpacity
            onPress={() => setShowChainPicker(true)}
            style={st.chainField}
            activeOpacity={0.75}
          >
            <View style={[st.chainDot, { backgroundColor: chain.color }]} />
            <Text style={st.chainName}>{chain.name}</Text>
            {isBridge && <Text style={st.chainBadge}>{t('card.bridge')}</Text>}
            <Ionicons name="chevron-down" size={16} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>

          {showGas ? (
            <View style={st.gasRow}>
              <Text style={st.gasLabel}>{t('card.gasFee')}</Text>
              <Text style={st.gasValue}>
                {gasEstimating
                  ? t('card.estimatingGas')
                  : t('card.gasUsdcValue', { gas: gasReserve.toFixed(2) })}
              </Text>
            </View>
          ) : null}

          {gasBlocked ? (
            <InlineErrorBanner
              title={t('card.insufficientUsdcForGasTitle')}
              message={t('card.insufficientUsdcForGasDetail', {
                balance: usdcBalance.toFixed(2),
                gas: gasReserve.toFixed(2),
              })}
              style={{ marginBottom: 12 }}
            />
          ) : null}

          {error ? (
            <InlineErrorBanner message={error} style={{ marginBottom: 12 }} />
          ) : null}

          {/* Continue */}
          <TouchableOpacity
            onPress={handleContinue}
            disabled={gasBlocked}
            style={[s.primaryBtn, { marginTop: 8 }, gasBlocked && { opacity: 0.5 }]}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isBridge ? ['#92400E', '#B45309'] : ['#1D4ED8', '#2563EB']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.primaryBtnGradient}
            >
              <Text style={s.primaryBtnText}>
                {isBridge ? t('card.previewBridgeTo', { chain: chain.name }) : t('card.previewSend')}
              </Text>
              <Ionicons name="arrow-forward" size={17} color="#FFF" />
            </LinearGradient>
          </TouchableOpacity>

          {!showGas ? (
            <Text style={s.networkNote}>{t('card.gasSponsoredNote')}</Text>
          ) : null}
        </ScrollView>

        {showChainPicker && (
          <ChainPickerSheet
            selected={chain}
            onSelect={setChain}
            onDismiss={() => setShowChainPicker(false)}
          />
        )}
      </View>
    </KeyboardAvoidingView>
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
      paddingTop: 8,
      paddingBottom: 64,
    },
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
      marginBottom: 24,
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
    chainField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.borderStrong,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 16,
    },
    chainDot: { width: 10, height: 10, borderRadius: 5 },
    chainName: { color: c.text, fontSize: 15, fontWeight: '600' },
    chainBadge: {
      fontSize: 11, fontWeight: '600', color: '#F59E0B',
      backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 6,
      paddingHorizontal: 7, paddingVertical: 2, overflow: 'hidden',
    },
    gasRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: -8,
      marginBottom: 16,
      paddingHorizontal: 2,
    },
    gasLabel: { color: c.textMuted, fontSize: 13 },
    gasValue: { color: c.text, fontSize: 13, fontWeight: '600' },
  });
}
