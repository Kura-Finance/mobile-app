import LoadingDots from '../../../shared/components/LoadingDots';
/**
 * TradeSheet
 *
 * Compact bottom-sheet swap UI: USDC ↔ token with a flip control.
 * Fetches a live Li.Fi quote (auto-refreshing every 20s) and executes through
 * the ERC-4337 smart account.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
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
import { userFacingTransactionError } from '../../../lib/wallet/userFacingTransactionError';
import { USDC_BASE, PAY_GAS_IN_USDC, GAS_RESERVE_FALLBACK_USDC } from '../../card/config/cardWalletConfig';
import { BLUE_CHIPS, type BluechipToken } from '../config/blueChips';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import InlineErrorBanner from '../../../shared/components/InlineErrorBanner';
import TokenLogo from '../components/TokenLogo';

function useStyles() {
  const { colors } = useTheme();
  return React.useMemo(() => makeStyles(colors), [colors]);
}

const REFRESH_INTERVAL = 5_000;
const USDC_DECIMALS = 6;
const USDC_TOKEN = BLUE_CHIPS.find((t) => t.symbol === 'USDC')!;

export type TradeSide = 'buy' | 'sell';

function formatTokenAmount(n: number): string {
  if (n === 0) return '0.00';
  if (n > 0 && n < 0.000001) return '<0.000001';
  if (n < 1) return n.toFixed(6);
  if (n < 1000) return n.toFixed(4);
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
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
  const money = useMoneyFormat();

  const [direction, setDirection] = useState<TradeSide>('buy');
  const [amountInput, setAmountInput] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteKey, setQuoteKey] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [execError, setExecError] = useState<string | null>(null);
  const [gasUsdc, setGasUsdc] = useState<number | null>(null);
  const [gasReserve, setGasReserve] = useState(() => (PAY_GAS_IN_USDC ? GAS_RESERVE_FALLBACK_USDC : 0));

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSell = direction === 'sell';
  const tokenSymbol = token?.displayName ?? '';
  const tokenDecimals = token?.decimals ?? 18;
  const fromToken = isSell ? token : USDC_TOKEN;
  const toToken = isSell ? USDC_TOKEN : token;

  const amountNum = parseFloat(amountInput) || 0;
  const spendBalance = isSell ? tokenHoldings : usdcBalance;
  const buyGasReserve = isSell ? 0 : gasReserve;
  const maxSpendable = Math.max(0, spendBalance - buyGasReserve);
  const hasValidAmount = amountNum > 0 && amountNum <= maxSpendable + 1e-9;
  const maxBlocked = !isSell && PAY_GAS_IN_USDC && maxSpendable <= 0;

  useEffect(() => {
    if (visible) {
      setDirection('buy');
      setAmountInput('');
      setQuote(null);
      setQuoteError(null);
      setTxHash(null);
      setExecError(null);
      setGasUsdc(null);
      setGasReserve(PAY_GAS_IN_USDC ? GAS_RESERVE_FALLBACK_USDC : 0);
    } else if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    estimateGasReserve()
      .then((r) => { if (alive) setGasReserve(r); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [visible, estimateGasReserve]);

  // When the gas reserve estimate lands, reclamp a stale MAX amount (buy only).
  useEffect(() => {
    if (!visible || isSell) return;
    setAmountInput((prev) => {
      if (!prev) return prev;
      const num = parseFloat(prev);
      if (!Number.isFinite(num) || num <= maxSpendable + 1e-9) return prev;
      return maxSpendable > 0 ? maxSpendable.toFixed(2) : '';
    });
  }, [gasReserve, maxSpendable, visible, isSell]);

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
      if (PAY_GAS_IN_USDC) {
        setGasUsdc(null);
        estimateSwapGasUsdc(q).then(setGasUsdc).catch(() => setGasUsdc(null));
      }
    } catch (e: unknown) {
      setQuoteError(userFacingTransactionError(e, 'crypto.quoteFailed'));
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
    } catch (e: unknown) {
      setExecError(userFacingTransactionError(e));
    }
  }, [quote, executeSwap, onTraded, t]);

  const setMaxAmount = useCallback(() => {
    if (isSell) {
      setAmountInput(tokenHoldings > 0 ? String(Number(tokenHoldings.toFixed(6))) : '');
    } else {
      setAmountInput(maxSpendable > 0 ? maxSpendable.toFixed(2) : '');
    }
  }, [isSell, tokenHoldings, maxSpendable]);

  const flipDirection = useCallback(() => {
    setDirection((d) => (d === 'buy' ? 'sell' : 'buy'));
    setAmountInput('');
    setQuote(null);
    setQuoteError(null);
    setGasUsdc(null);
    setExecError(null);
  }, []);

  const toAmountHuman = quote
    ? parseFloat(quote.toAmount) / Math.pow(10, quote.toToken.decimals)
    : 0;

  const toAmountDisplay = useMemo(() => {
    if (!hasValidAmount) return '0.00';
    if (quoteLoading && !quote) return '…';
    if (quoteError || !quote) return '0.00';
    if (isSell) return money.value(toAmountHuman);
    return formatTokenAmount(toAmountHuman);
  }, [hasValidAmount, quoteLoading, quote, quoteError, isSell, toAmountHuman, money]);

  if (!token || !fromToken || !toToken) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={st.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={st.backdrop} onPress={onClose} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={st.sheetHeader}>
            <View style={st.handle} />
          </View>
          <View style={st.titleRow}>
            <View style={st.titleGroup}>
              <Text style={st.title}>{t('crypto.swap')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {txHash ? (
            <View style={st.successBox}>
              <Ionicons name="checkmark-circle" size={40} color="#10B981" />
              <Text style={st.successTitle}>{t('crypto.swapSubmitted')}</Text>
              <TouchableOpacity onPress={onClose} style={st.doneBtn} activeOpacity={0.85}>
                <Text style={st.doneBtnText}>{t('crypto.done')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={st.swapStack}>
                {/* From */}
                <View style={st.swapCard}>
                  <View style={st.swapCardHeader}>
                    <Text style={st.swapLabel}>{t('crypto.from')}</Text>
                    <TouchableOpacity
                      onPress={setMaxAmount}
                      activeOpacity={0.7}
                      hitSlop={8}
                      disabled={maxBlocked || maxSpendable <= 0}
                    >
                      <Text style={[st.maxBtn, (maxBlocked || maxSpendable <= 0) && st.maxBtnDisabled]}>
                        {t('crypto.max')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={st.swapCardBody}>
                    <View style={st.tokenPicker}>
                      <TokenLogo token={fromToken} size={36} />
                      <Text style={st.tokenSymbol}>{isSell ? tokenSymbol : 'USDC'}</Text>
                    </View>
                    <TextInput
                      style={st.amountInput}
                      value={amountInput}
                      onChangeText={setAmountInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>

                <View style={st.flipWrap}>
                  <TouchableOpacity
                    style={st.flipBtn}
                    onPress={flipDirection}
                    activeOpacity={0.85}
                    accessibilityLabel={t('crypto.swap')}
                  >
                    <Ionicons name="swap-vertical" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>

                {/* To */}
                <View style={st.swapCard}>
                  <View style={st.swapCardHeader}>
                    <Text style={st.swapLabel}>{t('crypto.to')}</Text>
                    {quoteLoading && hasValidAmount ? (
                      <LoadingDots compact color={colors.textMuted} size={6}    />
                    ) : null}
                  </View>
                  <View style={st.swapCardBody}>
                    <View style={st.tokenPicker}>
                      <TokenLogo token={toToken} size={36} />
                      <Text style={st.tokenSymbol}>{isSell ? 'USDC' : tokenSymbol}</Text>
                    </View>
                    <Text
                      style={[
                        st.amountInput,
                        st.toAmount,
                        hasValidAmount && quote && !quoteLoading && toAmountHuman > 0 && st.toAmountActive,
                      ]}
                      numberOfLines={1}
                    >
                      {toAmountDisplay}
                    </Text>
                  </View>
                </View>
              </View>

              {amountNum > spendBalance + 1e-9 ? (
                <InlineErrorBanner
                  message={t('crypto.insufficientBalance', { symbol: isSell ? tokenSymbol : 'USDC' })}
                  style={{ marginTop: 10 }}
                />
              ) : !isSell && amountNum > maxSpendable + 1e-9 ? (
                <InlineErrorBanner
                  title={t('card.insufficientUsdcForGasTitle')}
                  message={t('card.amountLeaveGas')}
                  style={{ marginTop: 10 }}
                />
              ) : null}

              {quoteError ? (
                <InlineErrorBanner message={quoteError} style={{ marginTop: 12 }} />
              ) : null}

              {hasValidAmount && quote && !quoteLoading && (
                <View style={st.quoteCard}>
                  <CountdownBar key={quoteKey} durationMs={REFRESH_INTERVAL} />
                  <View style={st.quoteContent}>
                    <View style={st.quoteRow}>
                      <Text style={st.quoteLabel}>{t('crypto.fee')}</Text>
                      <Text style={st.quoteValueSub}>
                        {t('crypto.feeValue', { fee: money.price(parseFloat(quote.feeUSD) || 0) })}
                      </Text>
                    </View>
                    <View style={st.quoteRow}>
                      <Text style={st.quoteLabel}>{t('crypto.networkFee')}</Text>
                      <Text style={st.quoteValueSub}>
                        {!PAY_GAS_IN_USDC
                          ? t('crypto.gasSponsored')
                          : gasUsdc != null
                            ? t('crypto.gasUsdcValue', { gas: money.value(gasUsdc) })
                            : t('crypto.estimatingGas')}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {execError ? (
                <InlineErrorBanner message={execError} style={{ marginTop: 12 }} />
              ) : null}

              <TouchableOpacity
                style={[
                  st.execBtn,
                  (!quote || isExecutingSwap || !hasValidAmount) && st.execBtnDisabled,
                ]}
                onPress={handleExecute}
                disabled={!quote || isExecutingSwap || !hasValidAmount}
                activeOpacity={0.85}
              >
                {isExecutingSwap ? (
                  <LoadingDots compact color="#FFFFFF" size={6}    />
                ) : (
                  <Text style={st.execBtnText}>{t('crypto.swap')}</Text>
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
      marginBottom: 16,
    },
    titleGroup: { flexDirection: 'row', alignItems: 'center', gap: 6 },
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

    swapStack: { gap: 0 },
    swapCard: {
      backgroundColor: c.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
    },
    swapCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    swapLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600', letterSpacing: 0 },
    maxBtn: { color: c.primary, fontSize: 12, fontWeight: '600' },
    maxBtnDisabled: { opacity: 0.4 },
    swapCardBody: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    tokenPicker: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
    tokenSymbol: {
      color: c.text,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    amountInput: {
      flex: 1,
      color: c.text,
      fontSize: 32,
      fontWeight: '600',
      letterSpacing: 0,
      textAlign: 'right',
      padding: 0,
      minWidth: 0,
      ...(Platform.OS === 'ios' ? { fontVariant: ['tabular-nums' as const] } : {}),
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
    },
    toAmount: { color: c.textMuted, fontWeight: '600' },
    toAmountActive: { color: c.text },
    flipWrap: { alignItems: 'center', zIndex: 2, marginVertical: -18 },
    flipBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    },

    quoteCard: {
      backgroundColor: c.background,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      marginTop: 14,
      overflow: 'hidden',
    },
    quoteContent: { padding: 14, gap: 8 },
    quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    quoteLabel: { color: c.textMuted, fontSize: 13, fontWeight: '500' },
    quoteValueSub: { color: c.textMuted, fontSize: 13, fontWeight: '400' },

    execBtn: {
      height: 56,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 18,
      backgroundColor: c.primary,
    },
    execBtnDisabled: { backgroundColor: c.surfaceInput },
    execBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },

    successBox: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 24 },
    successTitle: { color: c.text, fontSize: 22, fontWeight: '700' },
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
