/**
 * Bottom sheet for Morpho Blue borrow / repay.
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
import { formatUnits, parseUnits } from 'viem';

import LoadingDots from '../../../shared/components/LoadingDots';
import InlineErrorBanner from '../../../shared/components/InlineErrorBanner';
import { userFacingTransactionError } from '../../../lib/wallet/userFacingTransactionError';
import { LegalDisclaimerInfoButton } from '../../../shared/components/LegalDisclaimer';
import MarketPairLogo from '../components/MarketPairLogo';
import SymbolLogo from '../components/SymbolLogo';
import type { MorphoMarket } from '../../../lib/api/morpho/markets';
import {
  computeMorphoLtvRatio,
  computeRemainingBorrowRaw,
  isMorphoBorrowWithinLltv,
  loanRawToAmount,
  readMorphoBorrowDebtAssets,
  readMorphoOnChainPosition,
  readMorphoOraclePrice,
  toMorphoMarketParams,
} from '../../../lib/wallet/morphoBlue';
import { readErc20Balance } from '../../../lib/wallet/morphoVault';
import {
  formatBorrowAvailableAmount,
  formatBorrowMaxInput,
  isMorphoMinCollateralMet,
  morphoMinCollateralAmount,
} from '../utils/borrowHub';
import {
  computeAdditionalCollateralForBorrow,
  formatUserLtvPercent,
  ltvRiskLevel,
  parseMarketMaxLltv,
} from '../utils/borrowLtv';
import { PAY_GAS_IN_USDC } from '../../card/config/cardWalletConfig';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';

export type BorrowAction = 'borrow' | 'repay' | 'withdraw';

/** Which borrow sub-flow to run when action is `borrow`. */
export type BorrowFlowMode = 'open' | 'borrowMore' | 'addCollateral';

type Step = 'input' | 'confirm';

interface Props {
  visible: boolean;
  action: BorrowAction;
  /** When action is `borrow`, controls open vs borrow-more vs add-collateral UI. */
  borrowFlow?: BorrowFlowMode;
  market: MorphoMarket | null;
  scaAddress: string;
  borrowedUsd: number;
  borrowAssetsRaw: string;
  loanDecimals: number;
  executeMorphoBorrow: UseKuraCardWalletReturn['executeMorphoBorrow'];
  executeMorphoRepay: UseKuraCardWalletReturn['executeMorphoRepay'];
  estimateMorphoBorrowGasUsdc: UseKuraCardWalletReturn['estimateMorphoBorrowGasUsdc'];
  estimateMorphoRepayGasUsdc: UseKuraCardWalletReturn['estimateMorphoRepayGasUsdc'];
  executeMorphoWithdrawCollateral: UseKuraCardWalletReturn['executeMorphoWithdrawCollateral'];
  estimateMorphoWithdrawCollateralGasUsdc:
    UseKuraCardWalletReturn['estimateMorphoWithdrawCollateralGasUsdc'];
  isExecutingBorrow: boolean;
  onClose: () => void;
  onCompleted?: (action: BorrowAction) => void;
}

function useStyles() {
  const { colors } = useTheme();
  return React.useMemo(() => makeStyles(colors), [colors]);
}

function formatDisplayAmount(n: number): string {
  if (n === 0) return '0.00';
  if (n < 0.0001) return n.toExponential(2);
  if (n < 1) return n.toFixed(6);
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function parseAmountRaw(input: string, decimals: number): bigint {
  const n = parseFloat(input) || 0;
  if (n <= 0) return 0n;
  const raw = n.toString();
  const [whole, frac = ''] = raw.split('.');
  const safe = frac ? `${whole}.${frac.slice(0, decimals)}` : whole;
  try {
    return parseUnits(safe as `${number}`, decimals);
  } catch {
    return 0n;
  }
}

function LtvPreviewCard({
  currentLtv,
  projectedLtv,
  maxLltv,
}: {
  currentLtv: number | null;
  projectedLtv: number | null;
  maxLltv: number | null;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();

  if (projectedLtv == null || maxLltv == null) return null;

  const risk = ltvRiskLevel(projectedLtv, maxLltv);
  const riskColor = risk === 'danger' ? colors.danger : risk === 'warning' ? '#F59E0B' : '#10B981';
  const fillPct = Math.min(100, (projectedLtv / maxLltv) * 100);
  const showCurrent = currentLtv != null && currentLtv > 0 && currentLtv !== projectedLtv;

  return (
    <View style={st.ltvPreviewCard}>
      <View style={st.ltvPreviewHeader}>
        <Text style={st.ltvPreviewLabel}>{t('crypto.borrowProjectedLtv')}</Text>
        <Text style={[st.ltvPreviewValue, { color: riskColor }]}>
          {formatUserLtvPercent(projectedLtv)}
        </Text>
      </View>
      {showCurrent ? (
        <Text style={st.ltvPreviewSub}>
          {t('crypto.borrowCurrentLtv', { ltv: formatUserLtvPercent(currentLtv) })}
        </Text>
      ) : null}
      <View style={st.ltvBarTrack}>
        <View style={[st.ltvBarFill, { width: `${fillPct}%`, backgroundColor: riskColor }]} />
      </View>
      <Text style={st.ltvPreviewHint}>
        {t('crypto.borrowMaxLtvHint', { max: formatUserLtvPercent(maxLltv) })}
      </Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  const st = useStyles();
  return (
    <View style={st.summaryRow}>
      <Text style={st.summaryLabel}>{label}</Text>
      <Text style={st.summaryValue}>{value}</Text>
    </View>
  );
}

export default function BorrowActionSheet({
  visible,
  action,
  borrowFlow = 'open',
  market,
  scaAddress,
  borrowedUsd,
  borrowAssetsRaw,
  loanDecimals,
  executeMorphoBorrow,
  executeMorphoRepay,
  estimateMorphoBorrowGasUsdc,
  estimateMorphoRepayGasUsdc,
  executeMorphoWithdrawCollateral,
  estimateMorphoWithdrawCollateralGasUsdc,
  isExecutingBorrow,
  onClose,
  onCompleted,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const money = useMoneyFormat();

  const [actionOverride, setActionOverride] = useState<BorrowAction | null>(null);
  const effectiveAction = actionOverride ?? action;
  const isBorrow = effectiveAction === 'borrow';
  const isRepay = effectiveAction === 'repay';
  const isWithdraw = effectiveAction === 'withdraw';
  const [step, setStep] = useState<Step>('input');
  const [collateralInput, setCollateralInput] = useState('');
  const [borrowInput, setBorrowInput] = useState('');
  const [repayInput, setRepayInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [collateralBalance, setCollateralBalance] = useState(0);
  const [loanBalance, setLoanBalance] = useState(0);
  const [collateralDeposited, setCollateralDeposited] = useState(0);
  const [hasOnChainDebt, setHasOnChainDebt] = useState(false);
  const [oraclePrice, setOraclePrice] = useState<bigint | null>(null);
  const [oracleLoading, setOracleLoading] = useState(false);
  const [positionCollateralRaw, setPositionCollateralRaw] = useState(0n);
  const [positionBorrowRaw, setPositionBorrowRaw] = useState(0n);
  const [positionBorrowShares, setPositionBorrowShares] = useState(0n);
  const [repayAll, setRepayAll] = useState(false);
  const [canWithdrawAfterRepay, setCanWithdrawAfterRepay] = useState(false);
  const [gasUsdc, setGasUsdc] = useState<number | null>(null);
  const [gasLoading, setGasLoading] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const currentBorrowAmount = useMemo(() => {
    if (positionBorrowRaw > 0n) {
      return parseFloat(formatUnits(positionBorrowRaw, loanDecimals));
    }
    try {
      return parseFloat(formatUnits(BigInt(borrowAssetsRaw || '0'), loanDecimals));
    } catch {
      return borrowedUsd;
    }
  }, [positionBorrowRaw, borrowAssetsRaw, loanDecimals, borrowedUsd]);

  const collateralAmount = parseFloat(collateralInput) || 0;
  const borrowAmount = parseFloat(borrowInput) || 0;
  const repayAmount = parseFloat(repayInput) || 0;
  const withdrawAmount = parseFloat(withdrawInput) || 0;

  const maxRepay = Math.max(currentBorrowAmount, 0);
  const maxWithdraw = Math.max(collateralDeposited, 0);
  const maxLltv = market ? parseMarketMaxLltv(market.lltv) : null;
  const hasExistingPosition = positionCollateralRaw > 0n || positionBorrowShares > 0n;
  const isAddCollateralFlow = isBorrow && borrowFlow === 'addCollateral';
  const isBorrowMoreFlow = isBorrow && borrowFlow === 'borrowMore';
  const isOpenBorrowFlow = isBorrow && borrowFlow === 'open';

  const projectedCollateralRaw = useMemo(() => {
    if (!market) return 0n;
    const add = isBorrow ? parseAmountRaw(collateralInput, market.collateralAsset.decimals) : 0n;
    return positionCollateralRaw + add;
  }, [market, isBorrow, collateralInput, positionCollateralRaw]);

  const projectedBorrowRaw = useMemo(() => {
    if (!market) return 0n;
    if (isBorrow) {
      return positionBorrowRaw + parseAmountRaw(borrowInput, market.loanAsset.decimals);
    }
    if (isRepay) {
      const repayRaw = parseAmountRaw(repayInput, market.loanAsset.decimals);
      return positionBorrowRaw > repayRaw ? positionBorrowRaw - repayRaw : 0n;
    }
    return positionBorrowRaw;
  }, [market, isBorrow, isRepay, borrowInput, repayInput, positionBorrowRaw]);

  const currentLtv = useMemo(() => {
    if (!oraclePrice || positionBorrowRaw <= 0n) return null;
    return computeMorphoLtvRatio({
      borrowRaw: positionBorrowRaw,
      collateralRaw: positionCollateralRaw,
      oraclePrice,
    });
  }, [oraclePrice, positionBorrowRaw, positionCollateralRaw]);

  const projectedLtv = useMemo(() => {
    if (!oraclePrice || projectedBorrowRaw <= 0n) return projectedBorrowRaw <= 0n ? 0 : null;
    return computeMorphoLtvRatio({
      borrowRaw: projectedBorrowRaw,
      collateralRaw: projectedCollateralRaw,
      oraclePrice,
    });
  }, [oraclePrice, projectedBorrowRaw, projectedCollateralRaw]);

  const exceedsMaxLltv = useMemo(() => {
    if (!market || !oraclePrice || !isBorrow || borrowAmount <= 0) return false;
    return !isMorphoBorrowWithinLltv({
      borrowRaw: projectedBorrowRaw,
      collateralRaw: projectedCollateralRaw,
      oraclePrice,
      lltv: BigInt(market.lltv),
    });
  }, [market, oraclePrice, isBorrow, borrowAmount, projectedBorrowRaw, projectedCollateralRaw]);

  const maxNewBorrow = useMemo(() => {
    if (!isBorrow || !market || !oraclePrice) return 0;
    const addRaw = isBorrowMoreFlow
      ? 0n
      : parseAmountRaw(collateralInput, market.collateralAsset.decimals);
    const totalCollateralRaw = positionCollateralRaw + addRaw;
    if (totalCollateralRaw <= 0n) return 0;
    const remainingRaw = computeRemainingBorrowRaw({
      collateralRaw: totalCollateralRaw,
      borrowRaw: positionBorrowRaw,
      oraclePrice,
      lltv: BigInt(market.lltv),
    });
    return loanRawToAmount(remainingRaw, market.loanAsset.decimals);
  }, [
    isBorrow,
    market,
    oraclePrice,
    collateralInput,
    positionCollateralRaw,
    positionBorrowRaw,
    isBorrowMoreFlow,
  ]);

  const collateralSupplyValid = collateralAmount <= 0
    || (collateralAmount <= collateralBalance + 1e-9
      && isMorphoMinCollateralMet(collateralAmount, market?.collateralAsset.symbol ?? ''));

  const collateralBelowMorphoMin = isBorrow
    && collateralAmount > 0
    && !isMorphoMinCollateralMet(collateralAmount, market?.collateralAsset.symbol ?? '');

  const showLtvPreview = (isBorrow || isRepay)
    && oraclePrice != null
    && (isBorrow
      ? isAddCollateralFlow
        ? collateralAmount > 0
        : borrowAmount > 0
      : repayAmount > 0);

  const hasValidBorrowIncrease =
    isBorrowMoreFlow
    && borrowAmount > 0
    && oraclePrice != null
    && !oracleLoading
    && borrowAmount <= maxNewBorrow + 1e-6
    && !exceedsMaxLltv
    && positionCollateralRaw > 0n;

  const hasValidCollateralOnly =
    isAddCollateralFlow
    && collateralAmount > 0
    && collateralSupplyValid;

  const hasValidBorrowOpen =
    isOpenBorrowFlow
    && borrowAmount > 0
    && collateralAmount > 0
    && collateralSupplyValid
    && oraclePrice != null
    && !oracleLoading
    && borrowAmount <= maxNewBorrow + 1e-6
    && !exceedsMaxLltv;

  const hasValidBorrow = hasValidCollateralOnly || hasValidBorrowIncrease || hasValidBorrowOpen;

  const isFullRepay = repayAll
    || (positionBorrowRaw > 0n
      && parseAmountRaw(repayInput, market?.loanAsset.decimals ?? loanDecimals) >= positionBorrowRaw);

  const hasValidRepay =
    repayAmount > 0
    && positionBorrowShares > 0n
    && (isFullRepay || repayAmount <= maxRepay + 1e-9)
    && (isFullRepay
      ? loanBalance + 1e-4 >= maxRepay - 1e-4
      : repayAmount <= loanBalance + 1e-9);

  const hasValidWithdraw =
    withdrawAmount > 0
    && withdrawAmount <= maxWithdraw + 1e-9
    && !hasOnChainDebt;

  const hasValidAmount = isBorrow ? hasValidBorrow : isRepay ? hasValidRepay : hasValidWithdraw;

  const handleBorrowInputChange = useCallback((text: string) => {
    setBorrowInput(text);
    if (!market || !oraclePrice || !isOpenBorrowFlow) return;

    const borrowNum = parseFloat(text) || 0;
    if (borrowNum <= 0) {
      setCollateralInput('');
      return;
    }

    const suggested = computeAdditionalCollateralForBorrow({
      borrowAmount: borrowNum,
      loanDecimals: market.loanAsset.decimals,
      collateralDecimals: market.collateralAsset.decimals,
      oraclePrice,
      existingCollateralRaw: positionCollateralRaw,
      existingBorrowRaw: positionBorrowRaw,
    });
    const capped = Math.min(suggested, collateralBalance);
    if (capped <= 0) {
      setCollateralInput('');
      return;
    }
    setCollateralInput(String(Number(capped.toFixed(6))));
  }, [market, oraclePrice, positionCollateralRaw, positionBorrowRaw, collateralBalance, isOpenBorrowFlow]);

  const applyMaxBorrow = useCallback(() => {
    if (!market || !oraclePrice) return;

    if (isBorrowMoreFlow) {
      const remainingRaw = computeRemainingBorrowRaw({
        collateralRaw: positionCollateralRaw,
        borrowRaw: positionBorrowRaw,
        oraclePrice,
        lltv: BigInt(market.lltv),
      });
      const maxB = loanRawToAmount(remainingRaw, market.loanAsset.decimals);
      if (maxB > 0) {
        setBorrowInput(formatBorrowMaxInput(maxB));
      }
      return;
    }

    if (collateralBalance <= 0) return;

    const collateralStr = String(Number(collateralBalance.toFixed(6)));
    setCollateralInput(collateralStr);

    const addRaw = parseAmountRaw(collateralStr, market.collateralAsset.decimals);
    const totalCollateralRaw = positionCollateralRaw + addRaw;
    const remainingRaw = computeRemainingBorrowRaw({
      collateralRaw: totalCollateralRaw,
      borrowRaw: positionBorrowRaw,
      oraclePrice,
      lltv: BigInt(market.lltv),
    });
    const maxB = loanRawToAmount(remainingRaw, market.loanAsset.decimals);
    if (maxB > 0) {
      setBorrowInput(formatBorrowMaxInput(maxB));
    }
  }, [market, oraclePrice, collateralBalance, positionCollateralRaw, positionBorrowRaw, isBorrowMoreFlow]);

  useEffect(() => {
    if (!visible) return;
    setStep('input');
    setCollateralInput('');
    setBorrowInput('');
    setRepayInput('');
    setWithdrawInput('');
    setRepayAll(false);
    setExecError(null);
    setTxHash(null);
    setGasUsdc(null);
    setCanWithdrawAfterRepay(false);
    setActionOverride(null);
  }, [visible, action, borrowFlow, market?.marketId]);

  const refreshPosition = useCallback(async () => {
    if (!market || !scaAddress || !market.oracleAddress || !market.irmAddress) {
      setOraclePrice(null);
      setOracleLoading(false);
      return null;
    }

    setOracleLoading(true);
    const mp = toMorphoMarketParams(market);
    const user = scaAddress as `0x${string}`;

    try {
      const price = await readMorphoOraclePrice(mp.oracle);
      setOraclePrice(price);
    } catch {
      setOraclePrice(null);
    }

    try {
      const position = await readMorphoOnChainPosition(mp, user);
      setPositionCollateralRaw(position.collateralRaw);
      setCollateralDeposited(position.collateralFormatted);
      setHasOnChainDebt(position.borrowShares > 0n);

      const debt = await readMorphoBorrowDebtAssets(mp, user);
      setPositionBorrowShares(debt.borrowShares);
      setPositionBorrowRaw(debt.borrowAssetsRaw);
      return position;
    } catch {
      setPositionCollateralRaw(0n);
      setPositionBorrowRaw(0n);
      setPositionBorrowShares(0n);
      setCollateralDeposited(0);
      setHasOnChainDebt(false);
      return null;
    } finally {
      setOracleLoading(false);
    }
  }, [market, scaAddress]);

  const applyMaxRepay = useCallback(() => {
    if (!market || positionBorrowRaw <= 0n) return;
    setRepayAll(true);
    setRepayInput(formatUnits(positionBorrowRaw, market.loanAsset.decimals));
  }, [market, positionBorrowRaw]);

  useEffect(() => {
    if (!visible || !market || !scaAddress) return;
    let alive = true;
    void refreshPosition().then((pos) => {
      if (!alive || !pos) return;
    });
    void readErc20Balance(
      market.collateralAsset.address as `0x${string}`,
      scaAddress as `0x${string}`,
      market.collateralAsset.decimals,
    ).then((bal) => { if (alive) setCollateralBalance(bal); });
    void readErc20Balance(
      market.loanAsset.address as `0x${string}`,
      scaAddress as `0x${string}`,
      market.loanAsset.decimals,
    ).then((bal) => { if (alive) setLoanBalance(bal); });
    return () => { alive = false; };
  }, [visible, market, scaAddress, refreshPosition]);

  useEffect(() => {
    if (!visible || step !== 'confirm' || !market || !hasValidAmount) {
      setGasUsdc(null);
      return;
    }
    let alive = true;
    setGasLoading(true);
    const estimate = isBorrow
      ? estimateMorphoBorrowGasUsdc({ market, collateralAmount, borrowAmount })
      : isRepay
        ? estimateMorphoRepayGasUsdc({ market, repayAmount, repayAll: isFullRepay })
        : estimateMorphoWithdrawCollateralGasUsdc({ market, withdrawAmount });

    void estimate
      .then((gas) => { if (alive) setGasUsdc(gas); })
      .catch(() => { if (alive) setGasUsdc(null); })
      .finally(() => { if (alive) setGasLoading(false); });

    return () => { alive = false; };
  }, [
    visible,
    step,
    market,
    hasValidAmount,
    isBorrow,
    isRepay,
    collateralAmount,
    borrowAmount,
    repayAmount,
    isFullRepay,
    withdrawAmount,
    estimateMorphoBorrowGasUsdc,
    estimateMorphoRepayGasUsdc,
    estimateMorphoWithdrawCollateralGasUsdc,
  ]);

  const handleExecute = useCallback(async () => {
    if (!market || !hasValidAmount) return;
    setExecError(null);
    try {
      const hash = isBorrow
        ? await executeMorphoBorrow({ market, collateralAmount, borrowAmount })
        : isRepay
          ? await executeMorphoRepay({ market, repayAmount, repayAll: isFullRepay })
          : await executeMorphoWithdrawCollateral({ market, withdrawAmount });
      setTxHash(hash);
      onCompleted?.(effectiveAction);
      if (isRepay) {
        const pos = await refreshPosition();
        if (pos && pos.borrowShares === 0n && pos.collateralRaw > 0n) {
          setCanWithdrawAfterRepay(true);
        }
      }
    } catch (e: unknown) {
      setExecError(userFacingTransactionError(e));
    }
  }, [
    market,
    hasValidAmount,
    isBorrow,
    isRepay,
    executeMorphoBorrow,
    executeMorphoRepay,
    executeMorphoWithdrawCollateral,
    collateralAmount,
    borrowAmount,
    repayAmount,
    isFullRepay,
    withdrawAmount,
    onCompleted,
    refreshPosition,
    effectiveAction,
  ]);

  if (!market) return null;

  const canTransact = Boolean(market.oracleAddress && market.irmAddress);
  const pairLabel = `${market.collateralAsset.symbol} / ${market.loanAsset.symbol}`;
  const headerTitle = step === 'confirm'
    ? t('card.confirm')
    : isBorrow
      ? isAddCollateralFlow
        ? t('crypto.borrowAddCollateralAction')
        : isBorrowMoreFlow
          ? t('crypto.borrowIncreaseAction')
          : t('crypto.borrowAction')
      : isRepay
        ? t('crypto.borrowRepayAction')
        : t('crypto.borrowWithdrawAction');

  const successTitle = isWithdraw
    ? t('crypto.borrowWithdrawSubmitted')
    : isRepay
      ? t('crypto.borrowRepaySubmitted')
      : isAddCollateralFlow
        ? t('crypto.borrowAddCollateralSubmitted')
        : isBorrowMoreFlow
          ? t('crypto.borrowIncreaseSubmitted')
          : t('crypto.borrowSubmitted');

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={st.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={st.backdrop} onPress={onClose} />
        <View style={[st.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={st.handle} />

          <View style={st.titleRow}>
            <View style={st.titleGroup}>
              <Text style={st.title}>{headerTitle}</Text>
              <LegalDisclaimerInfoButton variant="borrow" />
            </View>
            <TouchableOpacity onPress={onClose} style={st.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={st.marketRow}>
            <MarketPairLogo
              collateral={market.collateralAsset.symbol}
              loan={market.loanAsset.symbol}
              size={40}
            />
            <View style={st.marketMeta}>
              <Text style={st.marketName}>{pairLabel}</Text>
              <Text style={st.marketSub}>Morpho · Base</Text>
            </View>
          </View>

          {!canTransact ? (
            <InlineErrorBanner
              message={t('crypto.borrowMarketUnavailable')}
              hint={t('crypto.borrowMarketUnavailableHint')}
              style={{ marginBottom: 12 }}
            />
          ) : null}

          {txHash ? (
            <View style={st.successBox}>
              <Ionicons name="checkmark-circle" size={40} color="#10B981" />
              <Text style={st.successTitle}>{successTitle}</Text>
              {canWithdrawAfterRepay ? (
                <Text style={st.successHint}>{t('crypto.borrowWithdrawAfterRepayHint')}</Text>
              ) : null}
              {canWithdrawAfterRepay ? (
                <TouchableOpacity
                  onPress={() => {
                    setTxHash(null);
                    setStep('input');
                    setCanWithdrawAfterRepay(false);
                    setActionOverride('withdraw');
                    setWithdrawInput(String(Number(maxWithdraw.toFixed(6))));
                  }}
                  style={st.secondaryBtn}
                  activeOpacity={0.85}
                >
                  <Text style={st.secondaryBtnText}>{t('crypto.borrowWithdrawAction')}</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={onClose} style={st.doneBtn} activeOpacity={0.85}>
                <Text style={st.doneBtnText}>{t('crypto.done')}</Text>
              </TouchableOpacity>
            </View>
          ) : step === 'input' ? (
            <>
              {isBorrow ? (
                <>
                  {isBorrowMoreFlow ? (
                    <Text style={st.increaseHint}>{t('crypto.borrowBorrowMoreHint')}</Text>
                  ) : null}
                  {isAddCollateralFlow ? (
                    <Text style={st.increaseHint}>{t('crypto.borrowManageAddCollateralDesc')}</Text>
                  ) : null}

                  {!isAddCollateralFlow ? (
                    <>
                  <Text style={st.fieldLabel}>
                    {t('crypto.borrowLoanAmount', { symbol: market.loanAsset.symbol })}
                  </Text>
                  <View style={st.inputRow}>
                    <SymbolLogo symbol={market.loanAsset.symbol} size={28} />
                    <TextInput
                      style={st.input}
                      value={borrowInput}
                      onChangeText={handleBorrowInputChange}
                      placeholder="0.00"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      onPress={applyMaxBorrow}
                      hitSlop={8}
                      disabled={!oraclePrice || maxNewBorrow <= 0}
                    >
                      <Text style={[st.maxBtn, (!oraclePrice || maxNewBorrow <= 0) && st.maxBtnDisabled]}>
                        {t('crypto.max')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={st.available}>
                    {oracleLoading
                      ? t('crypto.borrowMaxEstimating')
                      : maxNewBorrow > 0
                        ? t('crypto.borrowMaxBorrowHint', {
                            amount: formatDisplayAmount(maxNewBorrow),
                            symbol: market.loanAsset.symbol,
                          })
                        : t('crypto.borrowLiquidityHint', { amount: money.compact(market.liquidityAssetsUsd) })}
                  </Text>
                  {isBorrowMoreFlow && maxRepay > 0 ? (
                    <Text style={st.available}>
                      {t('crypto.borrowOutstanding', {
                        amount: `${formatDisplayAmount(maxRepay)} ${market.loanAsset.symbol}`,
                      })}
                    </Text>
                  ) : null}
                    </>
                  ) : null}

                  {(isOpenBorrowFlow || isAddCollateralFlow) ? (
                    <>
                  <Text style={[st.fieldLabel, { marginTop: isAddCollateralFlow ? 0 : 16 }]}>
                    {t('crypto.borrowCollateralAmount', { symbol: market.collateralAsset.symbol })}
                  </Text>
                  <View style={st.inputRow}>
                    <SymbolLogo symbol={market.collateralAsset.symbol} size={28} />
                    <TextInput
                      style={st.input}
                      value={collateralInput}
                      onChangeText={setCollateralInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      onPress={() => setCollateralInput(String(Number(collateralBalance.toFixed(6))))}
                      hitSlop={8}
                    >
                      <Text style={st.maxBtn}>{t('crypto.max')}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={st.available}>
                    {t('crypto.availableDot', {
                      amount: `${formatBorrowAvailableAmount(collateralBalance, market.collateralAsset.symbol)} ${market.collateralAsset.symbol}`,
                    })}
                  </Text>
                  {isOpenBorrowFlow && borrowAmount > 0 && collateralAmount > 0 ? (
                    <Text style={st.autofillHint}>{t('crypto.borrowCollateralAutofillHint')}</Text>
                  ) : null}
                    </>
                  ) : null}
                  {showLtvPreview ? (
                    <LtvPreviewCard
                      currentLtv={currentLtv}
                      projectedLtv={projectedLtv}
                      maxLltv={maxLltv}
                    />
                  ) : null}
                </>
              ) : isRepay ? (
                <>
                  <Text style={st.fieldLabel}>
                    {t('crypto.borrowRepayAmount', { symbol: market.loanAsset.symbol })}
                  </Text>
                  <View style={st.inputRow}>
                    <SymbolLogo symbol={market.loanAsset.symbol} size={28} />
                    <TextInput
                      style={st.input}
                      value={repayInput}
                      onChangeText={(text) => {
                        setRepayAll(false);
                        setRepayInput(text);
                      }}
                      placeholder="0.00"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity onPress={applyMaxRepay} hitSlop={8}>
                      <Text style={st.maxBtn}>{t('crypto.max')}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={st.available}>
                    {t('crypto.borrowOutstanding', { amount: `${formatDisplayAmount(maxRepay)} ${market.loanAsset.symbol}` })}
                  </Text>
                  {showLtvPreview ? (
                    <LtvPreviewCard
                      currentLtv={currentLtv}
                      projectedLtv={projectedLtv}
                      maxLltv={maxLltv}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={st.fieldLabel}>
                    {t('crypto.borrowWithdrawAmount', { symbol: market.collateralAsset.symbol })}
                  </Text>
                  <View style={st.inputRow}>
                    <SymbolLogo symbol={market.collateralAsset.symbol} size={28} />
                    <TextInput
                      style={st.input}
                      value={withdrawInput}
                      onChangeText={setWithdrawInput}
                      placeholder="0.00"
                      placeholderTextColor={colors.textFaint}
                      keyboardType="decimal-pad"
                    />
                    <TouchableOpacity
                      onPress={() => setWithdrawInput(String(Number(maxWithdraw.toFixed(6))))}
                      hitSlop={8}
                    >
                      <Text style={st.maxBtn}>{t('crypto.max')}</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={st.available}>
                    {t('crypto.borrowDepositedCollateral', {
                      amount: `${formatDisplayAmount(maxWithdraw)} ${market.collateralAsset.symbol}`,
                    })}
                  </Text>
                  {hasOnChainDebt ? (
                    <InlineErrorBanner
                      message={t('crypto.borrowRepayBeforeWithdraw')}
                      hint={t('crypto.borrowRepayBeforeWithdrawHint')}
                      style={{ marginTop: 12 }}
                    />
                  ) : null}
                </>
              )}

              {isBorrow && !oracleLoading && oraclePrice == null && collateralAmount > 0 ? (
                <InlineErrorBanner
                  message={t('crypto.borrowOracleUnavailable')}
                  hint={t('crypto.borrowOracleUnavailableHint')}
                  style={{ marginTop: 12 }}
                />
              ) : null}

              {isBorrow && !isBorrowMoreFlow && collateralBelowMorphoMin ? (
                <InlineErrorBanner
                  message={t('crypto.borrowMinCollateral', {
                    amount: morphoMinCollateralAmount(market.collateralAsset.symbol) ?? 0,
                    symbol: market.collateralAsset.symbol,
                  })}
                  hint={t('crypto.borrowMinCollateralHint')}
                  style={{ marginTop: 12 }}
                />
              ) : null}

              {isBorrow && exceedsMaxLltv ? (
                <InlineErrorBanner
                  message={t('crypto.borrowLtvExceeded', {
                    max: formatUserLtvPercent(maxLltv),
                  })}
                  hint={t('crypto.borrowLtvExceededHint', {
                    max: formatUserLtvPercent(maxLltv),
                  })}
                  style={{ marginTop: 12 }}
                />
              ) : null}

              {isBorrow && !isBorrowMoreFlow && collateralAmount > collateralBalance + 1e-9 ? (
                <InlineErrorBanner
                  message={t('crypto.insufficientBalance', { symbol: market.collateralAsset.symbol })}
                  hint={t('crypto.insufficientBalanceHint', { symbol: market.collateralAsset.symbol })}
                  style={{ marginTop: 12 }}
                />
              ) : null}

              {execError ? <InlineErrorBanner message={execError} style={{ marginTop: 12 }} /> : null}

              <TouchableOpacity
                style={[st.primaryBtn, (!hasValidAmount || !canTransact) && st.primaryBtnDisabled]}
                disabled={!hasValidAmount || !canTransact}
                onPress={() => setStep('confirm')}
                activeOpacity={0.85}
              >
                <Text style={st.primaryBtnText}>
                  {isBorrow
                    ? isAddCollateralFlow
                      ? t('crypto.borrowReviewAddCollateral')
                      : isBorrowMoreFlow
                        ? t('crypto.borrowReviewIncrease')
                        : t('crypto.borrowReviewBorrow')
                    : isRepay
                      ? t('crypto.borrowReviewRepay')
                      : t('crypto.borrowReviewWithdraw')}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={st.summaryCard}>
                {isBorrow ? (
                  <>
                    {borrowAmount > 0 ? (
                      <SummaryRow
                        label={t('crypto.borrowLoanAmount', { symbol: market.loanAsset.symbol })}
                        value={`${formatDisplayAmount(borrowAmount)} ${market.loanAsset.symbol}`}
                      />
                    ) : null}
                    {collateralAmount > 0 ? (
                      <SummaryRow
                        label={t('crypto.borrowCollateralAmount', { symbol: market.collateralAsset.symbol })}
                        value={`${formatDisplayAmount(collateralAmount)} ${market.collateralAsset.symbol}`}
                      />
                    ) : null}
                  </>
                ) : isRepay ? (
                  <SummaryRow
                    label={t('crypto.borrowRepayAmount', { symbol: market.loanAsset.symbol })}
                    value={`${formatDisplayAmount(repayAmount)} ${market.loanAsset.symbol}`}
                  />
                ) : (
                  <SummaryRow
                    label={t('crypto.borrowWithdrawAmount', { symbol: market.collateralAsset.symbol })}
                    value={`${formatDisplayAmount(withdrawAmount)} ${market.collateralAsset.symbol}`}
                  />
                )}
                {(isBorrow || isRepay) && projectedLtv != null && maxLltv != null ? (
                  <SummaryRow
                    label={t('crypto.borrowProjectedLtv')}
                    value={formatUserLtvPercent(projectedLtv)}
                  />
                ) : null}
                <SummaryRow
                  label={t('crypto.networkFee')}
                  value={
                    !PAY_GAS_IN_USDC
                      ? t('crypto.gasSponsored')
                      : gasLoading || gasUsdc == null
                        ? t('crypto.estimatingGas')
                        : t('crypto.gasUsdcValue', { gas: money.value(gasUsdc) })
                  }
                />
              </View>

              {execError ? <InlineErrorBanner message={execError} style={{ marginTop: 12 }} /> : null}

              <View style={st.confirmRow}>
                <TouchableOpacity
                  style={[st.primaryBtn, st.confirmBtn, isExecutingBorrow && st.primaryBtnDisabled]}
                  disabled={isExecutingBorrow}
                  onPress={() => void handleExecute()}
                  activeOpacity={0.85}
                >
                  {isExecutingBorrow ? (
                    <LoadingDots compact color="#FFFFFF" size={6} />
                  ) : (
                    <Text style={st.primaryBtnText}>
                      {isBorrow
                        ? isAddCollateralFlow
                          ? t('crypto.borrowConfirmAddCollateral')
                          : isBorrowMoreFlow
                            ? t('crypto.borrowConfirmIncrease')
                            : t('crypto.borrowConfirmBorrow')
                        : isRepay
                          ? t('crypto.borrowConfirmRepay')
                          : t('crypto.borrowConfirmWithdraw')}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
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
    handle: {
      alignSelf: 'center',
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.borderStrong,
      marginBottom: 12,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
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
    marketRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    marketMeta: { flex: 1, gap: 2 },
    marketName: { color: c.text, fontSize: 16, fontWeight: '700' },
    marketSub: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
    fieldLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    input: {
      flex: 1,
      color: c.text,
      fontSize: 24,
      fontWeight: '600',
      padding: 0,
      textAlign: 'right',
    },
    maxBtn: { color: c.primary, fontSize: 12, fontWeight: '700' },
    maxBtnDisabled: { opacity: 0.4 },
    available: { color: c.textFaint, fontSize: 12, marginTop: 6 },
    autofillHint: { color: c.textFaint, fontSize: 11, marginTop: 4, fontStyle: 'italic' },
    increaseHint: { color: c.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 12 },
    ltvPreviewCard: {
      marginTop: 14,
      backgroundColor: c.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.border,
      padding: 12,
      gap: 6,
    },
    ltvPreviewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    ltvPreviewLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    ltvPreviewValue: { fontSize: 15, fontWeight: '700' },
    ltvPreviewSub: { color: c.textFaint, fontSize: 12 },
    ltvPreviewHint: { color: c.textFaint, fontSize: 11 },
    ltvBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.surfaceInput,
      overflow: 'hidden',
    },
    ltvBarFill: { height: '100%', borderRadius: 3 },
    summaryCard: {
      backgroundColor: c.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: c.border,
      padding: 14,
      gap: 10,
      marginBottom: 16,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 12,
    },
    summaryLabel: { color: c.textMuted, fontSize: 13, fontWeight: '500', flex: 1 },
    summaryValue: { color: c.text, fontSize: 14, fontWeight: '700' },
    confirmRow: { marginTop: 0 },
    primaryBtn: {
      height: 52,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.primary,
      marginTop: 18,
    },
    confirmBtn: { marginTop: 0 },
    primaryBtnDisabled: { backgroundColor: c.surfaceInput },
    primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    successBox: { alignItems: 'center', gap: 12, paddingVertical: 24 },
    successTitle: { color: c.text, fontSize: 20, fontWeight: '700' },
    successHint: { color: c.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: 12 },
    secondaryBtn: {
      height: 44,
      borderRadius: 14,
      backgroundColor: c.surfaceInput,
      paddingHorizontal: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryBtnText: { color: c.text, fontSize: 15, fontWeight: '700' },
    doneBtn: {
      marginTop: 8,
      height: 48,
      borderRadius: 14,
      backgroundColor: '#10B981',
      paddingHorizontal: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  });
}
