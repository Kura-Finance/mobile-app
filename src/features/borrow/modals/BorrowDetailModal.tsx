/**
 * BorrowDetailModal — full-screen Morpho market detail (aligned with EarnDetailModal).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import LoadingDots from '../../../shared/components/LoadingDots';
import MarketPairLogo from '../components/MarketPairLogo';
import { useBorrowMarketChart } from '../hooks/useBorrowMarketChart';
import {
  fetchMarketById,
  type MorphoMarket,
} from '../../../lib/api/morpho/markets';
import BorrowActionSheet, { type BorrowAction, type BorrowFlowMode } from './BorrowActionSheet';
import BorrowManageSheet from './BorrowManageSheet';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import PriceChart from '../../crypto/components/PriceChart';
import { TIMEFRAMES, type Timeframe } from '../../crypto/hooks/useTokenDetail';
import { formatChartTimeframe } from '../../crypto/utils/tokenDisplay';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useFavoritesStore } from '../../crypto/store/useFavoritesStore';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import { LegalDisclaimerInfoButton } from '../../../shared/components/LegalDisclaimer';
import { borrowFavoriteKey } from '../utils/borrowFavorites';
import {
  readMorphoUserPositionDisplay,
  toMorphoMarketParams,
  type MorphoUserPositionDisplay,
} from '../../../lib/wallet/morphoBlue';
import {
  computeUserLtvRatio,
  formatUserLtvPercent,
  ltvRiskLevel,
  parseMarketMaxLltv,
} from '../utils/borrowLtv';

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 200;
const BORROW_APY_COLOR = '#F59E0B';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

function formatApy(apy: number): string {
  if (!Number.isFinite(apy) || apy <= 0) return '—';
  return `${(apy * 100).toFixed(2)}%`;
}

function formatApyPercent(apyPercent: number): string {
  if (!Number.isFinite(apyPercent)) return '—';
  return `${apyPercent.toFixed(2)}%`;
}

function formatLltv(raw: string): string {
  return formatUserLtvPercent(parseMarketMaxLltv(raw));
}

function formatUtilization(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function StatRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const st = useStyles();
  return (
    <View style={st.statRow}>
      <Text style={st.statLabel}>{label}</Text>
      <View style={st.statRight}>
        <Text style={st.statValue}>{value}</Text>
        {sub ? <Text style={st.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

interface Props {
  visible: boolean;
  market: MorphoMarket | null;
  scaAddress: string;
  borrowedUsd: number;
  collateralUsd: number;
  borrowAssetsRaw?: string;
  onClose: () => void;
  onPositionChanged?: () => void;
}

export default function BorrowDetailModal({
  visible,
  market,
  scaAddress,
  borrowedUsd,
  collateralUsd,
  borrowAssetsRaw = '0',
  onClose,
  onPositionChanged,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const st = useStyles();
  const money = useMoneyFormat();
  const wallet = useKuraCardWallet();

  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);

  const [detail, setDetail] = useState<MorphoMarket | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>('24H');
  const [actionSheet, setActionSheet] = useState<BorrowAction | null>(null);
  const [manageSheetVisible, setManageSheetVisible] = useState(false);
  const [borrowFlow, setBorrowFlow] = useState<BorrowFlowMode>('open');
  const [chainPosition, setChainPosition] = useState<MorphoUserPositionDisplay | null>(null);
  const lastMarketRef = useRef<MorphoMarket | null>(null);

  useEffect(() => {
    if (!visible) {
      setActionSheet(null);
      setManageSheetVisible(false);
      setBorrowFlow('open');
    }
  }, [visible]);

  useEffect(() => {
    if (!market) return;
    setDetail(market);
    setDetailLoading(true);
    void fetchMarketById(market.marketId)
      .then((fresh) => { if (fresh) setDetail(fresh); })
      .finally(() => setDetailLoading(false));
  }, [market?.marketId]);

  const m = market ?? detail ?? lastMarketRef.current;
  if (m) lastMarketRef.current = m;

  const loadOnChainPosition = useCallback(async (): Promise<MorphoUserPositionDisplay | null> => {
    if (!m || !scaAddress || !m.oracleAddress || !m.irmAddress) {
      setChainPosition(null);
      return null;
    }
    try {
      const display = await readMorphoUserPositionDisplay(
        toMorphoMarketParams(m),
        scaAddress as `0x${string}`,
      );
      setChainPosition(display);
      return display;
    } catch {
      setChainPosition(null);
      return null;
    }
  }, [m, scaAddress]);

  useEffect(() => {
    if (!visible || !m || !scaAddress) return;
    void loadOnChainPosition();
  }, [visible, m?.marketId, scaAddress, loadOnChainPosition]);

  const displayBorrowUsd = chainPosition?.borrowAssetsUsd ?? borrowedUsd;
  const displayCollateralUsd = chainPosition?.collateralUsd ?? collateralUsd;
  const displayBorrowAssetsRaw = chainPosition
    ? chainPosition.borrowAssetsRaw.toString()
    : borrowAssetsRaw;
  const depositedCollateral = chainPosition?.collateralFormatted ?? 0;
  const hasOnChainDebt = chainPosition?.hasDebt ?? false;

  const { apys, chartLoading } = useBorrowMarketChart(
    m?.marketId ?? null,
    timeframe,
    visible && !!m,
  );

  const starred = m ? favorites.includes(borrowFavoriteKey(m)) : false;
  const borrowApy = m ? (m.avgNetBorrowApy || m.borrowApy) : 0;
  const hasBorrow = displayBorrowUsd > 0 || hasOnChainDebt;
  const hasWithdrawable = depositedCollateral > 0 && !hasOnChainDebt;
  const hasPosition = hasBorrow || depositedCollateral > 0;
  const userLtv = computeUserLtvRatio(displayBorrowUsd, displayCollateralUsd);
  const maxLltv = m ? parseMarketMaxLltv(m.lltv) : null;
  const ltvRisk = userLtv != null && maxLltv != null ? ltvRiskLevel(userLtv, maxLltv) : 'safe';
  const ltvFillPct = userLtv != null && maxLltv != null
    ? Math.min(100, (userLtv / maxLltv) * 100)
    : 0;
  const pairLabel = m
    ? `${m.collateralAsset.symbol} / ${m.loanAsset.symbol}`
    : '';

  const chartUp = apys.length >= 2 ? apys[apys.length - 1] >= apys[0] : true;
  const chartMin = apys.length ? Math.min(...apys) : 0;
  const chartMax = apys.length ? Math.max(...apys) : 0;
  const apyDelta = apys.length >= 2 ? apys[apys.length - 1] - apys[0] : null;
  const isPositive = (apyDelta ?? 0) >= 0;

  const openBorrow = useCallback(() => {
    if (hasPosition) {
      setManageSheetVisible(true);
      return;
    }
    setBorrowFlow('open');
    setActionSheet('borrow');
  }, [hasPosition]);

  const openBorrowMore = useCallback(() => {
    setManageSheetVisible(false);
    setBorrowFlow('borrowMore');
    setActionSheet('borrow');
  }, []);

  const openAddCollateral = useCallback(() => {
    setManageSheetVisible(false);
    setBorrowFlow('addCollateral');
    setActionSheet('borrow');
  }, []);

  const closeActionSheet = useCallback(() => {
    setActionSheet(null);
    setBorrowFlow('open');
  }, []);

  const openRepay = useCallback(() => {
    setActionSheet('repay');
  }, []);

  const openWithdraw = useCallback(() => {
    setActionSheet('withdraw');
  }, []);

  const handleCompleted = useCallback((completedAction: BorrowAction) => {
    onPositionChanged?.();
    void wallet.refreshBalance();

    void (async () => {
      const expectDebt = completedAction === 'borrow';
      for (let i = 0; i < 12; i++) {
        const display = await loadOnChainPosition();
        if (expectDebt && ((display?.borrowAssetsUsd ?? 0) > 0 || display?.hasDebt)) {
          onPositionChanged?.();
          return;
        }
        if (completedAction === 'repay' && display && !display.hasDebt) {
          onPositionChanged?.();
          return;
        }
        if (completedAction === 'withdraw') {
          onPositionChanged?.();
          return;
        }
        await new Promise((resolve) => { setTimeout(resolve, 1500); });
      }
      onPositionChanged?.();
    })();
  }, [onPositionChanged, wallet, loadOnChainPosition]);

  const handleModalDismiss = useCallback(() => {
    lastMarketRef.current = null;
    setDetail(null);
    setChainPosition(null);
  }, []);

  if (!m) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      onDismiss={handleModalDismiss}
    >
      <View style={st.root}>
        <View style={[st.topBar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={onClose} style={st.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={st.topTitleGroup}>
            <Text style={st.topTitle} numberOfLines={1}>{m.loanAsset.symbol}</Text>
            <LegalDisclaimerInfoButton variant="borrow" size={18} />
          </View>
          <View style={st.topRight}>
            <TouchableOpacity
              onPress={() => toggleFavorite(borrowFavoriteKey(m))}
              style={st.iconBtn}
              activeOpacity={0.7}
            >
              <Ionicons
                name={starred ? 'star' : 'star-outline'}
                size={18}
                color={starred ? '#F5AC37' : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          <View style={st.priceHeader}>
            <MarketPairLogo
              collateral={m.collateralAsset.symbol}
              loan={m.loanAsset.symbol}
              size={44}
            />
            <Text style={st.assetName}>{pairLabel}</Text>
            {detailLoading ? (
              <LoadingDots color={colors.primary} size={8} style={{ marginTop: 8 }} />
            ) : (
              <Text style={[st.bigPrice, { color: BORROW_APY_COLOR }]}>{formatApy(borrowApy)}</Text>
            )}
            {apyDelta != null ? (
              <View style={st.changeLine}>
                <Text style={[st.changeText, isPositive ? st.amber : st.green]}>
                  {isPositive ? '↗' : '↘'} {isPositive ? '+' : '−'}
                  {Math.abs(apyDelta).toFixed(2)}%
                </Text>
                <Text style={st.changeMuted}>{formatChartTimeframe(t, timeframe)}</Text>
              </View>
            ) : (
              <Text style={st.changeMuted}>{t('crypto.borrowNetApy')}</Text>
            )}
          </View>

          <View style={st.chartWrap}>
            <PriceChart
              prices={apys}
              width={SCREEN_W}
              height={CHART_H}
              loading={chartLoading}
              positive={chartUp}
            />
            {apys.length >= 2 && (
              <>
                <Text style={[st.chartLabel, { top: 6 }]}>{formatApyPercent(chartMax)}</Text>
                <Text style={[st.chartLabel, { bottom: 6 }]}>{formatApyPercent(chartMin)}</Text>
              </>
            )}
          </View>

          <View style={st.tfRow}>
            {TIMEFRAMES.map((tf) => {
              const activeTf = tf === timeframe;
              return (
                <TouchableOpacity
                  key={tf}
                  onPress={() => setTimeframe(tf)}
                  style={[st.tfBtn, activeTf && st.tfBtnActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[st.tfText, activeTf && st.tfTextActive]}>
                    {formatChartTimeframe(t, tf)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={st.balanceCard}>
            <Text style={st.balanceLabel}>{t('crypto.borrowYourPosition')}</Text>
            <Text style={st.balanceValue}>{money.value(displayBorrowUsd)}</Text>
            <Text style={st.balanceSub}>
              {hasBorrow
                ? t('crypto.borrowCollateralValue', { amount: money.compact(displayCollateralUsd) })
                : hasWithdrawable
                  ? t('crypto.borrowDepositedCollateral', {
                    amount: `${depositedCollateral.toFixed(4)} ${m.collateralAsset.symbol}`,
                  })
                  : t('crypto.borrowNoPosition')}
            </Text>
            {hasBorrow && userLtv != null && (
              <View style={st.ltvBlock}>
                <View style={st.ltvRow}>
                  <Text style={st.ltvLabel}>{t('crypto.borrowYourLtv')}</Text>
                  <Text style={[
                    st.ltvValue,
                    ltvRisk === 'danger' ? st.red : ltvRisk === 'warning' ? st.amber : st.green,
                  ]}
                  >
                    {formatUserLtvPercent(userLtv)}
                  </Text>
                </View>
                {maxLltv != null && (
                  <>
                    <View style={st.ltvBarTrack}>
                      <View
                        style={[
                          st.ltvBarFill,
                          { width: `${ltvFillPct}%` },
                          ltvRisk === 'danger' ? st.ltvBarDanger
                            : ltvRisk === 'warning' ? st.ltvBarWarning
                              : st.ltvBarSafe,
                        ]}
                      />
                    </View>
                    <Text style={st.ltvHint}>
                      {t('crypto.borrowMaxLtvHint', { max: formatUserLtvPercent(maxLltv) })}
                    </Text>
                  </>
                )}
              </View>
            )}
            <View style={st.balanceDivider} />
            <View style={st.balanceFooter}>
              <Text style={st.balanceFooterLabel}>{t('crypto.colBorrowApy')}</Text>
              <Text style={[st.balanceFooterVal, st.amber]}>{formatApy(borrowApy)}</Text>
            </View>
          </View>

          <View style={st.noteCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={st.noteText}>{t('crypto.borrowInAppNote')}</Text>
          </View>

          <Text style={st.sectionTitle}>{t('crypto.keyStats')}</Text>
          <View style={st.statsCard}>
            <StatRow label={t('crypto.colBorrowApy')} value={formatApy(borrowApy)} />
            {hasBorrow && userLtv != null && (
              <StatRow
                label={t('crypto.borrowYourLtv')}
                value={formatUserLtvPercent(userLtv)}
                sub={maxLltv != null
                  ? t('crypto.borrowMaxLtvHint', { max: formatUserLtvPercent(maxLltv) })
                  : undefined}
              />
            )}
            <StatRow label={t('crypto.borrowLltv')} value={formatLltv(m.lltv)} />
            <StatRow label={t('crypto.borrowUtilization')} value={formatUtilization(m.utilization)} />
            <StatRow label={t('crypto.borrowTotalBorrowed')} value={money.compact(m.borrowAssetsUsd)} />
            <StatRow label={t('crypto.borrowTotalSupply')} value={money.compact(m.supplyAssetsUsd)} />
            <StatRow label={t('crypto.borrowLiquidity')} value={money.compact(m.liquidityAssetsUsd)} />
            <StatRow
              label={t('crypto.borrowCollateral')}
              value={money.compact(m.collateralAssetsUsd)}
              sub={m.collateralAsset.symbol}
            />
          </View>

          <Text style={st.chartSourceNote}>{t('crypto.borrowSourceNote')}</Text>

          <Text style={st.sectionTitle}>{t('crypto.about')}</Text>
          <Text style={st.aboutText}>
            {t('crypto.borrowAboutFallback', {
              collateral: m.collateralAsset.symbol,
              loan: m.loanAsset.symbol,
            })}
          </Text>
        </ScrollView>

        <View style={[st.actionBar, { paddingBottom: insets.bottom + 10 }]}>
          <View style={st.actionRow}>
            {hasBorrow ? (
              <TouchableOpacity
                style={st.sellBtn}
                onPress={openRepay}
                activeOpacity={0.85}
              >
                <Ionicons name="remove-circle-outline" size={20} color={colors.text} />
                <Text style={st.sellBtnText}>{t('crypto.borrowRepayAction')}</Text>
              </TouchableOpacity>
            ) : hasWithdrawable ? (
              <TouchableOpacity
                style={st.sellBtn}
                onPress={openWithdraw}
                activeOpacity={0.85}
              >
                <Ionicons name="arrow-down-circle-outline" size={20} color={colors.text} />
                <Text style={st.sellBtnText}>{t('crypto.borrowWithdrawAction')}</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={[st.sellBtn, st.sellBtnDisabled]} disabled activeOpacity={0.85}>
                <Ionicons name="remove-circle-outline" size={20} color={colors.textFaint} />
                <Text style={[st.sellBtnText, st.disabledText]}>{t('crypto.borrowRepayAction')}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={st.buyBtn}
              onPress={openBorrow}
              activeOpacity={0.85}
            >
              <Ionicons
                name={hasPosition ? 'options-outline' : 'add-circle-outline'}
                size={20}
                color="#FFFFFF"
              />
              <Text style={st.buyBtnText}>
                {hasPosition ? t('crypto.borrowManageAction') : t('crypto.borrowAction')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <BorrowManageSheet
          visible={manageSheetVisible}
          onClose={() => setManageSheetVisible(false)}
          onBorrowMore={openBorrowMore}
          onAddCollateral={openAddCollateral}
        />

        <BorrowActionSheet
          visible={!!actionSheet}
          action={actionSheet ?? 'borrow'}
          borrowFlow={borrowFlow}
          market={m}
          scaAddress={scaAddress}
          borrowedUsd={displayBorrowUsd}
          borrowAssetsRaw={displayBorrowAssetsRaw}
          loanDecimals={m.loanAsset.decimals}
          executeMorphoBorrow={wallet.executeMorphoBorrow}
          executeMorphoRepay={wallet.executeMorphoRepay}
          executeMorphoWithdrawCollateral={wallet.executeMorphoWithdrawCollateral}
          estimateMorphoBorrowGasUsdc={wallet.estimateMorphoBorrowGasUsdc}
          estimateMorphoRepayGasUsdc={wallet.estimateMorphoRepayGasUsdc}
          estimateMorphoWithdrawCollateralGasUsdc={wallet.estimateMorphoWithdrawCollateralGasUsdc}
          isExecutingBorrow={wallet.isExecutingBorrow}
          onClose={closeActionSheet}
          onCompleted={handleCompleted}
        />
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    topTitleGroup: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: 8,
    },
    topTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
    topRight: { flexDirection: 'row', gap: 8, width: 40, justifyContent: 'flex-end' },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
    },

    priceHeader: { paddingHorizontal: 20, paddingTop: 8, gap: 6 },
    assetName: { color: c.textMuted, fontSize: 15, fontWeight: '600', marginTop: 6 },
    bigPrice: { color: c.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
    changeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    changeText: { fontSize: 14, fontWeight: '600' },
    changeMuted: { color: c.textMuted, fontSize: 14 },
    amber: { color: BORROW_APY_COLOR },
    green: { color: '#10B981' },
    red: { color: '#EF4444' },

    chartWrap: { marginTop: 16, height: CHART_H, position: 'relative' },
    chartLabel: {
      position: 'absolute',
      right: 12,
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    tfRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      marginTop: 14,
      gap: 4,
    },
    tfBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tfBtnActive: { backgroundColor: c.surfaceInput },
    tfText: { color: c.textMuted, fontSize: 12, fontWeight: '600' },
    tfTextActive: { color: c.text },

    balanceCard: {
      marginHorizontal: 16,
      marginTop: 22,
      backgroundColor: c.surfaceAlt,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 18,
    },
    balanceLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 6 },
    balanceValue: { color: c.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
    balanceSub: { color: c.textMuted, fontSize: 14, marginTop: 2 },
    ltvBlock: { marginTop: 14, gap: 8 },
    ltvRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ltvLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    ltvValue: { fontSize: 16, fontWeight: '800' },
    ltvBarTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.surface,
      overflow: 'hidden',
    },
    ltvBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    ltvBarSafe: { backgroundColor: '#10B981' },
    ltvBarWarning: { backgroundColor: BORROW_APY_COLOR },
    ltvBarDanger: { backgroundColor: '#EF4444' },
    ltvHint: { color: c.textFaint, fontSize: 11, fontWeight: '500' },
    balanceDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
      marginVertical: 14,
    },
    balanceFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    balanceFooterLabel: { color: c.textMuted, fontSize: 13, fontWeight: '500' },
    balanceFooterVal: { fontSize: 14, fontWeight: '700' },

    noteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginHorizontal: 16,
      marginTop: 22,
      backgroundColor: c.surfaceAlt,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    noteText: { flex: 1, color: c.textMuted, fontSize: 13, lineHeight: 19 },

    sectionTitle: {
      color: c.text,
      fontSize: 19,
      fontWeight: '700',
      paddingHorizontal: 20,
      marginTop: 28,
      marginBottom: 12,
    },
    statsCard: {
      marginHorizontal: 16,
      backgroundColor: c.surfaceAlt,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 16,
    },
    statRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    statLabel: { color: c.textMuted, fontSize: 14, fontWeight: '500' },
    statRight: { alignItems: 'flex-end', gap: 2 },
    statValue: { color: c.text, fontSize: 15, fontWeight: '700' },
    statSub: { color: c.textMuted, fontSize: 12 },

    chartSourceNote: {
      color: c.textFaint,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 10,
      paddingHorizontal: 20,
    },

    aboutText: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 21,
      paddingHorizontal: 20,
    },

    actionBar: {
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: c.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    actionRow: { flexDirection: 'row', gap: 12 },
    sellBtn: {
      flex: 1,
      height: 50,
      borderRadius: 16,
      backgroundColor: c.surfaceInput,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    sellBtnDisabled: { backgroundColor: c.surface },
    sellBtnText: { color: c.text, fontSize: 15, fontWeight: '700' },
    buyBtn: {
      flex: 1,
      height: 50,
      borderRadius: 16,
      backgroundColor: c.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    buyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    disabledText: { color: c.textFaint },
  });
}
