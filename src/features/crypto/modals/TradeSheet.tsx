/**
 * TradeSheet
 *
 * Compact bottom-sheet to buy or sell a token (Revolut / Kraken style).
 *  Buy  → spend USDC, receive the token.
 *  Sell → spend the token, receive USDC.
 *
 * Fetches a live Li.Fi quote (auto-refreshing every 5s) and executes the swap
 * through the ERC-4337 smart account.
 */
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
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
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { parseUnits } from 'viem';

import { fetchSwapQuote, SwapQuote } from '../../../lib/api/bridge/lifiSwapClient';
import { USDC_BASE, PAY_GAS_IN_USDC } from '../../card/config/cardWalletConfig';
import type { BluechipToken } from '../config/blueChips';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useHideBalance } from '../../../shared/hooks/useHideBalance';
import { formatSensitiveUsd } from '../../../shared/utils/privacyDisplay';

function useStyles() {
  const { colors } = useTheme();
  return React.useMemo(() => makeStyles(colors), [colors]);
}

const REFRESH_INTERVAL = 5_000;
const USDC_DECIMALS = 6;

export type TradeSide = 'buy' | 'sell';

function formatToken(n: number, symbol: string): string {
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.0001) return `${n.toExponential(2)} ${symbol}`;
  if (n < 1) return `${n.toFixed(6)} ${symbol}`;
  if (n < 1000) return `${n.toFixed(4)} ${symbol}`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symbol}`;
}

function toWei(amount: string, decimals: number): string {
  const trimmed = (amount || '0').trim();
  if (!trimmed || Number(trimmed) <= 0) return '0';
  try {
    const [whole, frac = ''] = trimmed.split('.');
    const safe = frac ? `${whole}.${frac.slice(0, decimals)}` : whole;
    return parseUnits(safe as `${number}`, decimals).toString();
  } catch {
    return '0';
  }
}

function CountdownBar({ durationMs }: { durationMs: number }) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    anim.setValue(1);
    Animated.timing(anim, {
      toValue: 0,
      duration: durationMs,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
  }, [anim, durationMs]);
  const widthPct = anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={[barTrack, { backgroundColor: colors.border }]}>
      <Animated.View style={[barFill, { width: widthPct, backgroundColor: colors.primary }]} />
    </View>
  );
}

const barTrack = { height: 2, borderRadius: 1, overflow: 'hidden' as const };
const barFill = { height: '100%' as const, borderRadius: 1 };

interface Props {
  visible: boolean;
  side: TradeSide;
  token: BluechipToken | null;
  tokenPrice: number;
  usdcBalance: number;
  tokenHoldings: number;
  scaAddress: string;
  executeSwap: UseKuraCardWalletReturn['executeSwap'];
  estimateSwapGasUsdc: UseKuraCardWalletReturn['estimateSwapGasUsdc'];
  estimateGasReserve: UseKuraCardWalletReturn['estimateUsdcGasReserve'];
  isExecutingSwap: boolean;
  onClose: () => void;
  onTraded?: () => void;
}

export default function TradeSheet({
  visible,
  side,
  token,
  tokenPrice,
  usdcBalance,
  tokenHoldings,
  scaAddress,
  executeSwap,
  estimateSwapGasUsdc,
  estimateGasReserve,
  isExecutingSwap,
  onClose,
  onTraded,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const hideBalance = useHideBalance();

  const [amountInput, setAmountInput] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteKey, setQuoteKey] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [gasUsdc, setGasUsdc] = useState<number | null>(null);
  const [gasReserve, setGasReserve] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSell = side === 'sell';
  const tokenSymbol = token?.displayName ?? '';
  const tokenDecimals = token?.decimals ?? 18;

  const amountNum = parseFloat(amountInput) || 0;
  const spendBalance = isSell ? tokenHoldings : usdcBalance;
  // Paying gas in USDC means a *buy* can't spend 100% of the USDC balance — the
  // ERC-20 paymaster pulls its fee in postOp, so keep a little USDC back. A sell
  // produces USDC before postOp, so it needs no reserve.
  const buyGasReserve = isSell ? 0 : gasReserve;
  const maxSpendable = Math.max(0, spendBalance - buyGasReserve);
  const hasValidAmount = amountNum > 0 && amountNum <= maxSpendable + 1e-9;
  const orderUsd = isSell ? amountNum * tokenPrice : amountNum;

  // ── Reset on open ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      setAmountInput('');
      setQuote(null);
      setQuoteError(null);
      setTxHash(null);
      setExecError(null);
      setGasUsdc(null);
      setGasReserve(0);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, [visible, side]);

  // Estimate the USDC to hold back for gas (0 when sponsored). Used to cap a buy
  // so it never leaves the SCA unable to pay the ERC-20 paymaster.
  useEffect(() => {
    if (!visible) return;
    let alive = true;
    estimateGasReserve()
      .then((r) => { if (alive) setGasReserve(r); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [visible, estimateGasReserve]);

  // ── Auto-refresh quote ─────────────────────────────────────────────────────
  const fetchQuote = useCallback(async () => {
    if (!token?.baseAddress || !scaAddress || !hasValidAmount) {
      setQuote(null);
      setGasUsdc(null);
      return;
    }
    setQuoteLoading(true);
    setQuoteError(null);
    try {
      const fromTokenAddress = isSell ? token.baseAddress : USDC_BASE;
      const toTokenAddress = isSell ? USDC_BASE : token.baseAddress;
      const fromDecimals = isSell ? tokenDecimals : USDC_DECIMALS;
      const fromAmountWei = toWei(amountInput, fromDecimals);
      if (fromAmountWei === '0') { setQuote(null); setGasUsdc(null); return; }
      const q = await fetchSwapQuote({
        fromAmountWei,
        fromAddress: scaAddress,
        fromTokenAddress,
        toTokenAddress,
      });
      setQuote(q);
      setQuoteKey((k) => k + 1);
      // Price the actual network fee (paid in USDC) for this exact route.
      if (PAY_GAS_IN_USDC) {
        setGasUsdc(null);
        estimateSwapGasUsdc(q).then(setGasUsdc).catch(() => setGasUsdc(null));
      }
    } catch (e: any) {
      setQuoteError(e?.message ?? t('crypto.quoteFailed'));
      setQuote(null);
      setGasUsdc(null);
    } finally {
      setQuoteLoading(false);
    }
  }, [token, scaAddress, amountInput, hasValidAmount, isSell, tokenDecimals, estimateSwapGasUsdc, t]);

  useEffect(() => {
    if (!visible || !hasValidAmount) { setQuote(null); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    fetchQuote();
    const schedule = () => {
      timerRef.current = setTimeout(() => { fetchQuote(); schedule(); }, REFRESH_INTERVAL);
    };
    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [fetchQuote, hasValidAmount, visible]);

  const handleExecute = useCallback(async () => {
    if (!quote) return;
    setExecError(null);
    try {
      const hash = await executeSwap(quote);
      setTxHash(hash);
      if (timerRef.current) clearTimeout(timerRef.current);
      onTraded?.();
    } catch (e: any) {
      setExecError(e?.message ?? t('crypto.transactionFailed'));
    }
  }, [quote, executeSwap, onTraded, t]);

  const setMaxAmount = useCallback(() => {
    if (isSell) {
      setAmountInput(tokenHoldings > 0 ? String(Number(tokenHoldings.toFixed(6))) : '');
    } else {
      setAmountInput(maxSpendable > 0 ? maxSpendable.toFixed(2) : '');
    }
  }, [isSell, tokenHoldings, maxSpendable]);

  const toAmountHuman = quote
    ? parseFloat(quote.toAmount) / Math.pow(10, quote.toToken.decimals)
    : 0;
  const receiveText = isSell ? formatSensitiveUsd(toAmountHuman, hideBalance) : formatToken(toAmountHuman, tokenSymbol);

  if (!token) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={st.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={st.backdrop} onPress={onClose} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Header */}
          <View style={st.sheetHeader}>
            <View style={st.handle} />
          </View>
          <View style={st.titleRow}>
            <Text style={st.title}>
              {isSell
                ? t('crypto.sellToken', { symbol: tokenSymbol })
                : t('crypto.buyToken', { symbol: tokenSymbol })}
            </Text>
            <TouchableOpacity onPress={onClose} style={st.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {txHash ? (
            <View style={st.successBox}>
              <Ionicons name="checkmark-circle" size={40} color="#10B981" />
              <Text style={st.successTitle}>{isSell ? t('crypto.sellSubmitted') : t('crypto.buySubmitted')}</Text>
              <Text style={st.successSub}>
                {isSell
                  ? t('crypto.sellingSummary', {
                      from: formatToken(amountNum, tokenSymbol),
                      to: formatSensitiveUsd(toAmountHuman, hideBalance),
                    })
                  : t('crypto.buyingSummary', {
                      from: formatSensitiveUsd(amountNum, hideBalance),
                      to: formatToken(toAmountHuman, tokenSymbol),
                    })}
              </Text>
              <TouchableOpacity onPress={onClose} style={st.doneBtn} activeOpacity={0.85}>
                <Text style={st.doneBtnText}>{t('crypto.done')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Available balance */}
              <Text style={st.balanceHint}>
                {t('crypto.available', {
                  amount: isSell ? formatToken(tokenHoldings, tokenSymbol) : formatSensitiveUsd(usdcBalance, hideBalance),
                })}
              </Text>

              {/* Amount input */}
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
                />
                {isSell && <Text style={st.inputSuffix}>{tokenSymbol}</Text>}
                <TouchableOpacity onPress={setMaxAmount} style={st.maxBtn} activeOpacity={0.7}>
                  <Text style={st.maxBtnText}>{t('crypto.max')}</Text>
                </TouchableOpacity>
              </View>
              {amountNum > spendBalance + 1e-9 ? (
                <Text style={st.insufficientText}>
                  {t('crypto.insufficientBalance', { symbol: isSell ? tokenSymbol : 'USDC' })}
                </Text>
              ) : !isSell && amountNum > maxSpendable + 1e-9 ? (
                <Text style={st.insufficientText}>{t('crypto.leaveUsdcForGas')}</Text>
              ) : isSell && amountNum > 0 ? (
                <Text style={st.subHint}>≈ {formatSensitiveUsd(orderUsd, hideBalance)}</Text>
              ) : null}

              {/* Quote card */}
              {hasValidAmount && (
                <View style={st.quoteCard}>
                  {!quoteLoading && quote && <CountdownBar key={quoteKey} durationMs={REFRESH_INTERVAL} />}
                  <View style={st.quoteContent}>
                    {quoteLoading && !quote ? (
                      <View style={st.quoteLoading}>
                        <ActivityIndicator size="small" color={colors.primary} />
                        <Text style={st.quoteLoadingText}>{t('crypto.fetchingRoute')}</Text>
                      </View>
                    ) : quoteError ? (
                      <View style={st.quoteErrorRow}>
                        <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                        <Text style={st.quoteErrorText}>{quoteError}</Text>
                      </View>
                    ) : quote ? (
                      <>
                        <View style={st.quoteRow}>
                          <Text style={st.quoteLabel}>{t('crypto.youReceive')}</Text>
                          <Text style={st.quoteValue}>{receiveText}</Text>
                        </View>
                        <View style={st.quoteDivider} />
                        <View style={st.quoteRow}>
                          <Text style={st.quoteLabel}>{t('crypto.fee')}</Text>
                          <Text style={st.quoteValueSub}>{t('crypto.feeValue', { fee: quote.feeUSD })}</Text>
                        </View>
                        <View style={st.quoteRow}>
                          <Text style={st.quoteLabel}>{t('crypto.networkFee')}</Text>
                          <Text style={st.quoteValueSub}>
                            {!PAY_GAS_IN_USDC
                              ? t('crypto.gasSponsored')
                              : gasUsdc != null
                                ? t('crypto.gasUsdcValue', { gas: gasUsdc.toFixed(2) })
                                : t('crypto.estimatingGas')}
                          </Text>
                        </View>
                      </>
                    ) : null}
                  </View>
                </View>
              )}

              {execError && (
                <View style={st.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
                  <Text style={st.errorText}>{execError}</Text>
                </View>
              )}

              <TouchableOpacity
                style={[
                  st.execBtn,
                  isSell ? st.execBtnSell : st.execBtnBuy,
                  (!quote || isExecutingSwap || !hasValidAmount) && st.execBtnDisabled,
                ]}
                onPress={handleExecute}
                disabled={!quote || isExecutingSwap || !hasValidAmount}
                activeOpacity={0.85}
              >
                {isExecutingSwap ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={st.execBtnText}>
                    {isSell
                      ? `${t('crypto.sellToken', { symbol: tokenSymbol })}${orderUsd > 0 ? ` · ${formatSensitiveUsd(orderUsd, hideBalance)}` : ''}`
                      : `${t('crypto.buyToken', { symbol: tokenSymbol })}${amountNum > 0 ? ` · ${formatSensitiveUsd(amountNum, hideBalance)}` : ''}`}
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 18,
    },
    title: { color: c.text, fontSize: 20, fontWeight: '700' },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    balanceHint: { color: c.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 10 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.borderStrong,
      paddingHorizontal: 16,
      height: 64,
      gap: 6,
    },
    inputCurrency: { color: c.textMuted, fontSize: 24, fontWeight: '600' },
    inputSuffix: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    input: { flex: 1, color: c.text, fontSize: 28, fontWeight: '700', padding: 0 },
    maxBtn: {
      backgroundColor: c.primarySoft,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: c.primarySoft,
    },
    maxBtnText: { color: c.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
    insufficientText: { color: c.danger, fontSize: 12, fontWeight: '500', marginTop: 8 },
    subHint: { color: c.textMuted, fontSize: 13, fontWeight: '500', marginTop: 8 },

    quoteCard: {
      backgroundColor: c.background,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      marginTop: 16,
      overflow: 'hidden',
    },
    quoteContent: { padding: 16, gap: 10 },
    quoteLoading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    quoteLoadingText: { color: c.textMuted, fontSize: 13 },
    quoteErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    quoteErrorText: { color: c.danger, fontSize: 12, flex: 1 },
    quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    quoteLabel: { color: c.textMuted, fontSize: 13, fontWeight: '500' },
    quoteValue: { color: c.text, fontSize: 15, fontWeight: '700' },
    quoteValueSub: { color: c.textMuted, fontSize: 13, fontWeight: '400' },
    quoteDivider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.2)',
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginTop: 12,
    },
    errorText: { color: c.danger, fontSize: 12, flex: 1 },

    execBtn: {
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
    },
    execBtnBuy: { backgroundColor: c.primary },
    execBtnSell: { backgroundColor: '#EF4444' },
    execBtnDisabled: { backgroundColor: c.surfaceInput },
    execBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    successBox: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 24 },
    successTitle: { color: c.text, fontSize: 22, fontWeight: '700' },
    successSub: { color: c.textMuted, fontSize: 14, textAlign: 'center' },
    doneBtn: {
      marginTop: 8,
      height: 52,
      borderRadius: 14,
      backgroundColor: '#10B981',
      paddingHorizontal: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
}
