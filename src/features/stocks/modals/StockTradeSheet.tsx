/**
 * StockTradeSheet
 *
 * Compact buy/sell sheet for a Dinari dShare (market order).
 *  Buy  → spend USDC (paymentTokenQuantity).
 *  Sell → sell shares (assetTokenQuantity).
 *
 * Runs the prepare → SCA-sign → submit → poll flow via {@link placeDinariOrder}.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { placeDinariOrder, StockItem } from '../hooks/useDinari';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useHideBalance } from '../../../shared/hooks/useHideBalance';
import { formatUsdCompact, formatSensitiveUsd } from '../../../shared/utils/privacyDisplay';

export type TradeSide = 'buy' | 'sell';

interface Props {
  visible: boolean;
  side: TradeSide;
  stock: StockItem | null;
  usdcBalance: number;
  scaAddress: string;
  signTypedData: UseKuraCardWalletReturn['signTypedData'];
  onClose: () => void;
  onTraded?: () => void;
}

export default function StockTradeSheet({
  visible,
  side,
  stock,
  usdcBalance,
  scaAddress,
  signTypedData,
  onClose,
  onTraded,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const hideBalance = useHideBalance();

  const [amountInput, setAmountInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [result, setResult] = useState<'ok' | 'fail' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const isSell = side === 'sell';
  const symbol = stock?.symbol ?? '';
  const price = stock?.price ?? 0;
  const holdings = stock?.holdings ?? 0;

  const amountNum = parseFloat(amountInput) || 0;
  const spendBalance = isSell ? holdings : usdcBalance;
  const hasValidAmount = amountNum > 0 && amountNum <= spendBalance + 1e-9;

  // BUY input is USD; SELL input is shares.
  const estShares = !isSell && price > 0 ? amountNum / price : 0;
  const estUsd = isSell ? amountNum * price : amountNum;

  useEffect(() => {
    if (visible) {
      setAmountInput('');
      setBusy(false);
      setStatusText('');
      setResult(null);
      setError(null);
      cancelledRef.current = false;
    } else {
      cancelledRef.current = true;
    }
  }, [visible, side]);

  const handleConfirm = useCallback(async () => {
    if (!stock || !hasValidAmount) return;
    setBusy(true);
    setError(null);
    setResult(null);
    cancelledRef.current = false;
    try {
      const res = await placeDinariOrder({
        side: isSell ? 'SELL' : 'BUY',
        stockId: stock.id,
        quantity: isSell ? String(amountNum) : String(amountNum),
        signTypedData,
        onStatus: setStatusText,
        isCancelled: () => cancelledRef.current,
      });
      if (res.ok) {
        setResult('ok');
        onTraded?.();
      } else {
        setResult('fail');
        setError(`Order ${res.status.toLowerCase()}.`);
      }
    } catch (e: any) {
      setResult('fail');
      setError(e?.message ?? 'Order failed.');
    } finally {
      setBusy(false);
      setStatusText('');
    }
  }, [stock, hasValidAmount, isSell, amountNum, signTypedData, onTraded]);

  const setMax = useCallback(() => {
    if (isSell) setAmountInput(holdings > 0 ? String(Number(holdings.toFixed(6))) : '');
    else setAmountInput(usdcBalance > 0 ? usdcBalance.toFixed(2) : '');
  }, [isSell, holdings, usdcBalance]);

  if (!stock) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={st.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={st.backdrop} onPress={busy ? undefined : onClose} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={st.sheetHeader}><View style={st.handle} /></View>
          <View style={st.titleRow}>
            <Text style={st.title}>{isSell ? 'Sell' : 'Buy'} {symbol}</Text>
            <TouchableOpacity onPress={onClose} style={st.closeBtn} activeOpacity={0.7} disabled={busy}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {result === 'ok' ? (
            <View style={st.successBox}>
              <Ionicons name="checkmark-circle" size={40} color="#10B981" />
              <Text style={st.successTitle}>{isSell ? 'Sell filled!' : 'Buy filled!'}</Text>
              <Text style={st.successSub}>
                {isSell
                  ? `Sold ${amountNum} ${symbol} ≈ ${formatSensitiveUsd(estUsd, hideBalance)}`
                  : `Bought ≈ ${estShares.toFixed(4)} ${symbol} with ${formatSensitiveUsd(estUsd, hideBalance)}`}
              </Text>
              <TouchableOpacity onPress={onClose} style={st.doneBtn} activeOpacity={0.85}>
                <Text style={st.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={st.balanceHint}>
                {isSell
                  ? `Available: ${holdings.toLocaleString('en-US', { maximumFractionDigits: 6 })} ${symbol}`
                  : `Available: ${formatSensitiveUsd(usdcBalance, hideBalance)}`}
              </Text>

              <View style={st.inputRow}>
                {!isSell && <Text style={st.inputCurrency}>$</Text>}
                <TextInput
                  style={st.input}
                  value={amountInput}
                  onChangeText={setAmountInput}
                  placeholder="0.00"
                  placeholderTextColor={colors.textFaint}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                  editable={!busy}
                />
                {isSell && <Text style={st.inputSuffix}>{symbol}</Text>}
                <TouchableOpacity onPress={setMax} style={st.maxBtn} activeOpacity={0.7} disabled={busy}>
                  <Text style={st.maxBtnText}>MAX</Text>
                </TouchableOpacity>
              </View>

              {amountNum > spendBalance + 1e-9 ? (
                <Text style={st.insufficient}>
                  Insufficient {isSell ? symbol : 'USDC'} balance
                </Text>
              ) : amountNum > 0 ? (
                <Text style={st.subHint}>
                  {isSell
                    ? `≈ ${formatSensitiveUsd(estUsd, hideBalance)}`
                    : `≈ ${estShares.toFixed(4)} ${symbol} @ ${formatUsdCompact(price)}`}
                </Text>
              ) : null}

              <View style={st.infoRow}>
                <Ionicons name="time-outline" size={13} color={colors.textMuted} />
                <Text style={st.infoText}>
                  Market order · fills during US market hours · gas sponsored
                </Text>
              </View>

              {error && (
                <View style={st.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                  <Text style={st.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  st.execBtn,
                  isSell ? st.execSell : st.execBuy,
                  (!hasValidAmount || busy) && st.execDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!hasValidAmount || busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <View style={st.busyRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={st.execText}>{statusText || 'Processing…'}</Text>
                  </View>
                ) : (
                  <Text style={st.execText}>
                    {isSell
                      ? `Sell ${symbol}${estUsd > 0 ? ` · ${formatSensitiveUsd(estUsd, hideBalance)}` : ''}`
                      : `Buy ${symbol}${amountNum > 0 ? ` · ${formatSensitiveUsd(amountNum, hideBalance)}` : ''}`}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, justifyContent: 'flex-end' },
    backdrop: { ...StyleSheet.absoluteFillObject },
    sheet: {
      backgroundColor: c.surfaceAlt,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    sheetHeader: { alignItems: 'center', paddingVertical: 8 },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.borderStrong },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
    title: { color: c.text, fontSize: 20, fontWeight: '700' },
    closeBtn: {
      width: 32, height: 32, borderRadius: 16, backgroundColor: c.surface,
      borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center',
    },
    balanceHint: { color: c.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 10 },
    inputRow: {
      flexDirection: 'row', alignItems: 'center', backgroundColor: c.background,
      borderRadius: 14, borderWidth: 1, borderColor: c.borderStrong,
      paddingHorizontal: 16, height: 64, gap: 6,
    },
    inputCurrency: { color: c.textMuted, fontSize: 24, fontWeight: '600' },
    inputSuffix: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    input: { flex: 1, color: c.text, fontSize: 28, fontWeight: '700', padding: 0 },
    maxBtn: {
      backgroundColor: c.primarySoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
      borderWidth: 1, borderColor: c.primarySoft,
    },
    maxBtnText: { color: c.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    insufficient: { color: c.danger, fontSize: 12, fontWeight: '500', marginTop: 8 },
    subHint: { color: c.textMuted, fontSize: 13, fontWeight: '500', marginTop: 8 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
    infoText: { color: c.textMuted, fontSize: 12, flex: 1 },
    errorBox: {
      flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.08)',
      borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
      paddingHorizontal: 14, paddingVertical: 10, marginTop: 12,
    },
    errorText: { color: c.danger, fontSize: 12, flex: 1 },
    execBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
    execBuy: { backgroundColor: c.primary },
    execSell: { backgroundColor: c.danger },
    execDisabled: { backgroundColor: c.surfaceInput },
    execText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    busyRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    successBox: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 24 },
    successTitle: { color: c.text, fontSize: 22, fontWeight: '700' },
    successSub: { color: c.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 12 },
    doneBtn: {
      marginTop: 8, height: 52, borderRadius: 14, backgroundColor: '#10B981',
      paddingHorizontal: 48, alignItems: 'center', justifyContent: 'center',
    },
    doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
}
