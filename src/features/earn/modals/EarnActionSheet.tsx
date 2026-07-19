import LoadingDots from '../../../shared/components/LoadingDots';
/**
 * Bottom sheet for Morpho vault deposit / withdraw.
 * Two-step flow: amount input → confirm (Swap-style UX).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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

import VaultLogo from '../components/VaultLogo';
import TokenLogo from '../../crypto/components/TokenLogo';
import { BLUE_CHIPS } from '../../crypto/config/blueChips';
import type { MorphoVault } from '../../../lib/api/morpho/client';
import {
  formatEarnFeePercent,
  appliesEarnServiceFee,
} from '../../../config/earn';
import { readErc20Balance } from '../../../lib/wallet/morphoVault';
import { PAY_GAS_IN_USDC, GAS_RESERVE_FALLBACK_USDC } from '../../card/config/cardWalletConfig';
import type {
  MorphoEarnVaultParams,
  UseKuraCardWalletReturn,
} from '../../card/hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { HIDDEN_BALANCE_TEXT } from '../../../shared/utils/privacyDisplay';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import InlineErrorBanner from '../../../shared/components/InlineErrorBanner';
import { userFacingTransactionError } from '../../../lib/wallet/userFacingTransactionError';

function useStyles() {
  const { colors } = useTheme();
  return React.useMemo(() => makeStyles(colors), [colors]);
}

export type EarnAction = 'deposit' | 'withdraw';

type Step = 'input' | 'confirm';

interface Props {
  visible: boolean;
  action: EarnAction;
  vault: MorphoVault | null;
  depositAddress: string;
  usesFeeWrapper: boolean;
  vaultBalance: number;
  scaAddress: string;
  executeMorphoDeposit: UseKuraCardWalletReturn['executeMorphoDeposit'];
  executeMorphoWithdraw: UseKuraCardWalletReturn['executeMorphoWithdraw'];
  estimateMorphoDepositGasUsdc: UseKuraCardWalletReturn['estimateMorphoDepositGasUsdc'];
  estimateMorphoWithdrawGasUsdc: UseKuraCardWalletReturn['estimateMorphoWithdrawGasUsdc'];
  estimateGasReserve: UseKuraCardWalletReturn['estimateUsdcGasReserve'];
  isExecutingEarn: boolean;
  onClose: () => void;
  onCompleted?: () => void;
}

function formatDisplayAmount(n: number): string {
  if (n === 0) return '0.00';
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6);
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function SummaryRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: object;
}) {
  const st = useStyles();
  return (
    <View style={st.summaryRow}>
      <Text style={st.summaryLabel}>{label}</Text>
      <Text style={[st.summaryValue, valueStyle]}>{value}</Text>
    </View>
  );
}

export default function EarnActionSheet({
  visible,
  action,
  vault,
  depositAddress,
  usesFeeWrapper,
  vaultBalance,
  scaAddress,
  executeMorphoDeposit,
  executeMorphoWithdraw,
  estimateMorphoDepositGasUsdc,
  estimateMorphoWithdrawGasUsdc,
  estimateGasReserve,
  isExecutingEarn,
  onClose,
  onCompleted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const money = useMoneyFormat();

  const [step, setStep] = useState<Step>('input');
  const [amountInput, setAmountInput] = useState('');
  const [assetBalance, setAssetBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [gasUsdc, setGasUsdc] = useState<number | null>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const [gasReserve, setGasReserve] = useState(PAY_GAS_IN_USDC ? GAS_RESERVE_FALLBACK_USDC : 0);
  const [execError, setExecError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const isDeposit = action === 'deposit';
  const symbol = vault?.asset.symbol ?? '';
  const spendBalance = isDeposit ? assetBalance : vaultBalance;
  const gasBuffer = isDeposit && symbol === 'USDC' && PAY_GAS_IN_USDC ? gasReserve : 0;
  const maxSpendable = Math.max(0, spendBalance - gasBuffer);
  const amountNum = parseFloat(amountInput) || 0;
  const hasValidAmount = amountNum > 0 && amountNum <= maxSpendable + 1e-9;
  const insufficientBalance = amountNum > spendBalance + 1e-9;
  const insufficientForGas = isDeposit && symbol === 'USDC' && amountNum > maxSpendable + 1e-9 && amountNum <= spendBalance + 1e-9;

  const assetToken = useMemo(
    () => BLUE_CHIPS.find((tok) => tok.symbol.toUpperCase() === symbol.toUpperCase()) ?? null,
    [symbol],
  );

  const earnParams = useMemo((): MorphoEarnVaultParams | null => {
    if (!vault || !depositAddress) return null;
    return {
      innerVaultAddress: vault.address as `0x${string}`,
      depositVaultAddress: depositAddress as `0x${string}`,
      usesFeeWrapper,
      asset: {
        address: vault.asset.address as `0x${string}`,
        decimals: vault.asset.decimals,
        symbol: vault.asset.symbol,
      },
    };
  }, [vault, depositAddress, usesFeeWrapper]);

  const showServiceFee = vault ? appliesEarnServiceFee(vault.address) || usesFeeWrapper : false;

  useEffect(() => {
    if (visible) {
      setStep('input');
      setAmountInput('');
      setExecError(null);
      setTxHash(null);
      setGasUsdc(null);
      setGasLoading(false);
      setGasReserve(PAY_GAS_IN_USDC ? GAS_RESERVE_FALLBACK_USDC : 0);
    }
  }, [visible, action]);

  useEffect(() => {
    if (!visible || !isDeposit || !vault || !scaAddress) return;
    let alive = true;
    setLoadingBalance(true);
    readErc20Balance(
      vault.asset.address as `0x${string}`,
      scaAddress as `0x${string}`,
      vault.asset.decimals,
    )
      .then((bal) => { if (alive) setAssetBalance(bal); })
      .catch(() => { if (alive) setAssetBalance(0); })
      .finally(() => { if (alive) setLoadingBalance(false); });
    return () => { alive = false; };
  }, [visible, isDeposit, vault, scaAddress]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    estimateGasReserve()
      .then((r) => { if (alive) setGasReserve(r); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [visible, estimateGasReserve]);

  const fetchGasEstimate = useCallback(async () => {
    if (!earnParams || !hasValidAmount) {
      setGasUsdc(null);
      return;
    }
    setGasLoading(true);
    try {
      const estimate = isDeposit
        ? estimateMorphoDepositGasUsdc({ ...earnParams, amount: amountNum })
        : estimateMorphoWithdrawGasUsdc({
            ...earnParams,
            withdrawAll: false,
            amountAssets: amountNum,
          });
      setGasUsdc(await estimate);
    } catch {
      setGasUsdc(null);
    } finally {
      setGasLoading(false);
    }
  }, [
    earnParams,
    hasValidAmount,
    isDeposit,
    amountNum,
    estimateMorphoDepositGasUsdc,
    estimateMorphoWithdrawGasUsdc,
  ]);

  useEffect(() => {
    if (!visible || step !== 'confirm' || !hasValidAmount) return;
    fetchGasEstimate();
  }, [visible, step, hasValidAmount, fetchGasEstimate]);

  const setMaxAmount = useCallback(() => {
    if (maxSpendable <= 0) {
      setAmountInput('');
      return;
    }
    const decimals = isDeposit && symbol === 'USDC' ? 2 : 6;
    setAmountInput(maxSpendable.toFixed(decimals));
  }, [maxSpendable, isDeposit, symbol]);

  const handleReview = useCallback(() => {
    if (!hasValidAmount) return;
    setExecError(null);
    setStep('confirm');
  }, [hasValidAmount]);

  const handleBack = useCallback(() => {
    setExecError(null);
    setStep('input');
  }, []);

  const handleExecute = useCallback(async () => {
    if (!earnParams || !hasValidAmount) return;
    setExecError(null);
    try {
      const hash = isDeposit
        ? await executeMorphoDeposit({ ...earnParams, amount: amountNum })
        : await executeMorphoWithdraw({
            ...earnParams,
            withdrawAll: Math.abs(amountNum - maxSpendable) < 1e-8,
            amountAssets: amountNum,
          });
      setTxHash(hash);
      onCompleted?.();
    } catch (e: unknown) {
      setExecError(userFacingTransactionError(e));
    }
  }, [
    earnParams,
    hasValidAmount,
    isDeposit,
    executeMorphoDeposit,
    executeMorphoWithdraw,
    amountNum,
    maxSpendable,
    onCompleted,
    t,
  ]);

  if (!vault) return null;

  const actionTitle = isDeposit ? t('crypto.earnDepositAction') : t('crypto.earnWithdrawAction');
  const reviewLabel = isDeposit ? t('crypto.earnReviewDeposit') : t('crypto.earnReviewWithdraw');
  const confirmLabel = isDeposit ? t('crypto.earnConfirmDeposit') : t('crypto.earnConfirmWithdraw');
  const headerTitle = step === 'confirm' ? t('card.confirm') : actionTitle;

  const receiveAmount = formatDisplayAmount(amountNum);
  const sendAmountText = `${formatDisplayAmount(amountNum)} ${symbol}`;

  const renderGasValue = () => {
    if (!PAY_GAS_IN_USDC) return t('crypto.gasSponsored');
    if (gasLoading || gasUsdc == null) return t('crypto.estimatingGas');
    return t('crypto.gasUsdcValue', { gas: money.value(gasUsdc) });
  };

  const renderWalletToken = () => {
    if (assetToken) {
      return (
        <View style={st.tokenPicker}>
          <TokenLogo token={assetToken} size={36} />
          <Text style={st.tokenSymbol}>{symbol}</Text>
        </View>
      );
    }
    return (
      <View style={st.tokenPicker}>
        <View style={st.fallbackIcon}>
          <Ionicons name="wallet-outline" size={18} color={colors.textMuted} />
        </View>
        <Text style={st.tokenSymbol}>{symbol}</Text>
      </View>
    );
  };

  const renderVaultToken = () => (
    <View style={st.tokenPicker}>
      <VaultLogo vault={vault} size={36} />
      <Text style={st.vaultSymbol} numberOfLines={1}>{symbol}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={st.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={st.backdrop} onPress={isExecutingEarn ? undefined : onClose} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={st.sheetHeader}>
            <View style={st.handle} />
          </View>
          <View style={st.titleRow}>
            {step === 'confirm' ? (
              <TouchableOpacity onPress={handleBack} style={st.backBtn} activeOpacity={0.7} disabled={isExecutingEarn}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
            ) : null}
            <View style={st.titleGroup}>
              <Text style={st.title} numberOfLines={1}>{headerTitle}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.closeBtn} activeOpacity={0.7} disabled={isExecutingEarn}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {txHash ? (
            <View style={st.successBox}>
              <Ionicons name="checkmark-circle" size={40} color="#10B981" />
              <Text style={st.successTitle}>{t('crypto.earnTxSubmitted')}</Text>
              <Text style={st.successSub}>
                {t('crypto.earnSwapSummary', {
                  from: isDeposit ? sendAmountText : vault.name,
                  to: isDeposit ? vault.name : sendAmountText,
                })}
              </Text>
              <TouchableOpacity onPress={onClose} style={st.doneBtn} activeOpacity={0.85}>
                <Text style={st.doneBtnText}>{t('crypto.done')}</Text>
              </TouchableOpacity>
            </View>
          ) : step === 'input' ? (
            <>
              <View style={st.swapStack}>
                <View style={st.swapCard}>
                  <View style={st.swapCardHeader}>
                    <Text style={st.swapLabel}>{t('crypto.from')}</Text>
                    <TouchableOpacity
                      onPress={setMaxAmount}
                      activeOpacity={0.7}
                      hitSlop={8}
                      disabled={maxSpendable <= 0}
                    >
                      <Text style={[st.maxBtn, maxSpendable <= 0 && st.maxBtnDisabled]}>
                        {t('crypto.max')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <View style={st.swapCardBody}>
                    {isDeposit ? renderWalletToken() : renderVaultToken()}
                    <View style={st.amountField}>
                      <TextInput
                        style={st.amountInput}
                        value={amountInput}
                        onChangeText={setAmountInput}
                        placeholder="0.00"
                        placeholderTextColor={colors.textFaint}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                      />
                    </View>
                  </View>
                  <Text style={st.balanceHint}>
                    {isDeposit
                      ? loadingBalance
                        ? t('common.loading')
                        : t('crypto.earnAvailable', {
                            amount: money.hideBalance ? HIDDEN_BALANCE_TEXT : formatDisplayAmount(assetBalance),
                            symbol,
                          })
                      : t('crypto.earnVaultBalance', {
                          amount: money.hideBalance ? HIDDEN_BALANCE_TEXT : formatDisplayAmount(vaultBalance),
                          symbol,
                        })}
                  </Text>
                </View>

                <View style={st.arrowWrap}>
                  <View style={st.arrowBtn}>
                    <Ionicons name="arrow-down" size={18} color={colors.textMuted} />
                  </View>
                </View>

                <View style={st.swapCard}>
                  <View style={st.swapCardHeader}>
                    <Text style={st.swapLabel}>{t('crypto.to')}</Text>
                  </View>
                  <View style={st.swapCardBody}>
                    {isDeposit ? renderVaultToken() : renderWalletToken()}
                    <View style={st.amountField}>
                      <Text
                        style={[
                          st.amountInput,
                          st.toAmount,
                          hasValidAmount && st.toAmountActive,
                        ]}
                        numberOfLines={1}
                      >
                        {hasValidAmount ? receiveAmount : '0.00'}
                      </Text>
                    </View>
                  </View>
                  <Text style={st.balanceHint} numberOfLines={1}>
                    {isDeposit ? vault.name : t('crypto.earnWalletReceive', { symbol })}
                  </Text>
                </View>
              </View>

              {insufficientBalance ? (
                <InlineErrorBanner
                  message={t('crypto.insufficientBalance', { symbol: isDeposit ? symbol : vault.name })}
                  style={{ marginTop: 10 }}
                />
              ) : insufficientForGas ? (
                <InlineErrorBanner
                  title={t('card.insufficientUsdcForGasTitle')}
                  message={t('card.amountLeaveGas')}
                  style={{ marginTop: 10 }}
                />
              ) : null}

              <Text style={st.reviewNote}>{t('crypto.earnReviewNote')}</Text>

              <TouchableOpacity
                style={[st.execBtn, !hasValidAmount && st.execBtnDisabled]}
                onPress={handleReview}
                disabled={!hasValidAmount}
                activeOpacity={0.85}
              >
                <Text style={st.execBtnText}>{reviewLabel}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={st.vaultSummaryCard}>
                <VaultLogo vault={vault} size={40} />
                <View style={st.vaultSummaryMeta}>
                  <Text style={st.vaultSummaryName} numberOfLines={2}>{vault.name}</Text>
                  <Text style={st.vaultSummaryAsset}>{symbol} · Base</Text>
                </View>
              </View>

              <View style={st.summaryBox}>
                <SummaryRow
                  label={t('card.youSend')}
                  value={`${sendAmountText}`}
                  valueStyle={st.amountValue}
                />
                <SummaryRow
                  label={t('crypto.youReceive')}
                  value={`${receiveAmount} ${symbol}`}
                  valueStyle={st.receiveValue}
                />
                <View style={st.divider} />
                <SummaryRow label={t('card.network')} value="Base" />
                <SummaryRow label={t('crypto.networkFee')} value={renderGasValue()} />
                {showServiceFee ? (
                  <SummaryRow
                    label={t('crypto.earnServiceFee')}
                    value={formatEarnFeePercent()}
                    valueStyle={st.feeValue}
                  />
                ) : null}
              </View>

              {showServiceFee ? (
                <Text style={st.feeNote}>
                  {t('crypto.earnServiceFeeNote', { fee: formatEarnFeePercent() })}
                </Text>
              ) : null}

              {execError ? <InlineErrorBanner message={execError} style={{ marginTop: 12 }} /> : null}

              <TouchableOpacity
                style={[
                  st.execBtn,
                  (isExecutingEarn || (PAY_GAS_IN_USDC && gasLoading)) && st.execBtnDisabled,
                ]}
                onPress={handleExecute}
                disabled={isExecutingEarn || (PAY_GAS_IN_USDC && gasLoading)}
                activeOpacity={0.85}
              >
                {isExecutingEarn ? (
                  <LoadingDots compact color="#FFFFFF" size={6}    />
                ) : (
                  <Text style={st.execBtnText}>{confirmLabel}</Text>
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
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderStrong,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
      gap: 8,
    },
    backBtn: {
      width: 32,
      height: 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    titleGroup: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      flexShrink: 1,
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
    },
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
    swapLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    maxBtn: { color: c.primary, fontSize: 12, fontWeight: '600' },
    maxBtnDisabled: { opacity: 0.4 },
    swapCardBody: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    tokenPicker: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0, maxWidth: '45%' },
    tokenSymbol: {
      color: c.text,
      fontSize: 20,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    vaultSymbol: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.3,
      flexShrink: 1,
    },
    fallbackIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceInput,
      alignItems: 'center',
      justifyContent: 'center',
    },
    amountField: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      minWidth: 0,
    },
    amountInput: {
      flexGrow: 0,
      flexShrink: 1,
      color: c.text,
      fontSize: 32,
      fontWeight: '600',
      letterSpacing: 0,
      textAlign: 'right',
      padding: 0,
      maxWidth: '100%',
      ...(Platform.OS === 'ios' ? { fontVariant: ['tabular-nums' as const] } : {}),
      ...(Platform.OS === 'android' ? { includeFontPadding: false } : {}),
    },
    toAmount: { color: c.textMuted, fontWeight: '600' },
    toAmountActive: { color: c.text },
    balanceHint: { color: c.textFaint, fontSize: 12, marginTop: 10 },
    arrowWrap: { alignItems: 'center', zIndex: 2, marginVertical: -14 },
    arrowBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.surfaceAlt,
      borderWidth: 1,
      borderColor: c.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reviewNote: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 14,
      textAlign: 'center',
    },

    vaultSummaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 14,
      padding: 14,
      backgroundColor: c.background,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    vaultSummaryMeta: { flex: 1, gap: 4 },
    vaultSummaryName: { color: c.text, fontSize: 15, fontWeight: '700' },
    vaultSummaryAsset: { color: c.textMuted, fontSize: 12 },

    summaryBox: {
      backgroundColor: c.background,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 16,
      gap: 10,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    summaryLabel: { color: c.textMuted, fontSize: 14, fontWeight: '500' },
    summaryValue: { color: c.text, fontSize: 14, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
    amountValue: { fontSize: 16, fontWeight: '700' },
    receiveValue: { color: '#10B981', fontWeight: '700' },
    feeValue: { color: c.textMuted },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 2,
    },
    feeNote: {
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 18,
      marginTop: 12,
    },

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
    successSub: { color: c.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 12 },
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
