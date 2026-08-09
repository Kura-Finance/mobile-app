import LoadingDots from '../../../shared/components/LoadingDots';
/**
 * EarnDetailModal
 *
 * Full-screen vault detail aligned with {@link TokenDetailModal} / {@link StockDetailModal}:
 * APY header · historical APY chart · balance card · key stats · about ·
 * fixed Withdraw / Deposit bar.
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

import VaultLogo from '../components/VaultLogo';
import EarnActionSheet, { type EarnAction } from './EarnActionSheet';
import { useMorphoVaultPosition } from '../hooks/useMorphoVaultPosition';
import { useEarnVaultChart } from '../hooks/useEarnVaultChart';
import {
  getMorphoVault,
  type MorphoVault,
} from '../../../lib/api/morpho/client';
import {
  appliesEarnServiceFee,
  effectiveEarnNetApy,
  formatEarnFeePercent,
  MORPHO_FEE_WRAPPER_OVERRIDES,
  resolveMorphoDepositFromMap,
} from '../../../config/earn';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import PriceChart from '../../crypto/components/PriceChart';
import { TIMEFRAMES, type Timeframe } from '../../crypto/hooks/useTokenDetail';
import { formatChartTimeframe } from '../../crypto/utils/tokenDisplay';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useFavoritesStore } from '../../crypto/store/useFavoritesStore';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import { earnFavoriteKey } from '../utils/earnFavorites';

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 200;

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

function formatFee(fee: number): string {
  if (!Number.isFinite(fee)) return '—';
  return `${(fee * 100).toFixed(2)}%`;
}

function formatHoldings(n: number, symbol: string): string {
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.0001) return `${n.toExponential(2)} ${symbol}`;
  if (n < 1) return `${n.toFixed(6)} ${symbol}`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symbol}`;
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
  vault: MorphoVault | null;
  scaAddress: string;
  depositedUsd: number;
  onClose: () => void;
  onPositionChanged?: () => void;
}

export default function EarnDetailModal({
  visible,
  vault,
  scaAddress,
  depositedUsd,
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

  const [detail, setDetail] = useState<MorphoVault | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionSheet, setActionSheet] = useState<EarnAction | null>(null);
  const [positionRefreshKey, setPositionRefreshKey] = useState(0);
  const [timeframe, setTimeframe] = useState<Timeframe>('24H');
  const lastVaultRef = useRef<MorphoVault | null>(null);

  useEffect(() => {
    if (!vault) return;
    setDetail(vault);
    setDetailLoading(true);
    void getMorphoVault(vault.address)
      .then((fresh) => { if (fresh) setDetail(fresh); })
      .finally(() => setDetailLoading(false));
  }, [vault?.address]);

  useEffect(() => {
    if (!visible) setActionSheet(null);
  }, [visible]);

  const v = vault ?? detail ?? lastVaultRef.current;
  if (v) lastVaultRef.current = v;
  const position = useMorphoVaultPosition(v, scaAddress, positionRefreshKey);
  const { apys, chartLoading } = useEarnVaultChart(
    v?.address ?? null,
    timeframe,
    visible && !!v,
  );

  const starred = v ? favorites.includes(earnFavoriteKey(v)) : false;
  const grossNetApy = v?.netApy ?? 0;
  const depositRouting = useMemo(
    () => resolveMorphoDepositFromMap(v?.address ?? '', MORPHO_FEE_WRAPPER_OVERRIDES),
    [v?.address],
  );
  const appliesServiceFee = appliesEarnServiceFee(v?.address ?? '');
  const displayNetApy = effectiveEarnNetApy(grossNetApy, appliesServiceFee);
  const balanceUsd = depositedUsd > 0 ? depositedUsd : position.assetsFormatted;
  const tokenBalance = position.assetsFormatted > 0 ? position.assetsFormatted : depositedUsd;
  const hasDeposit = balanceUsd > 0;

  const chartUp = apys.length >= 2 ? apys[apys.length - 1] >= apys[0] : displayNetApy >= 0;
  const chartMin = apys.length ? Math.min(...apys) : 0;
  const chartMax = apys.length ? Math.max(...apys) : 0;

  /** Change in APY over the selected period (percentage points, not relative %). */
  const apyDelta = apys.length >= 2 ? apys[apys.length - 1] - apys[0] : null;
  const isPositive = (apyDelta ?? 0) >= 0;

  const handleCompleted = useCallback(() => {
    setPositionRefreshKey((k) => k + 1);
    onPositionChanged?.();
    void wallet.refreshBalance();
  }, [onPositionChanged, wallet]);

  const handleModalDismiss = useCallback(() => {
    lastVaultRef.current = null;
    setDetail(null);
    setActionSheet(null);
  }, []);

  if (!v) return null;

  const topTitle = v.asset.symbol;

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
              <Text style={st.topTitle}>{topTitle}</Text>
            </View>
            <View style={st.topRight}>
              <TouchableOpacity
                onPress={() => toggleFavorite(earnFavoriteKey(v))}
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
              <View style={st.logoWrap}>
                <VaultLogo vault={v} size={44} />
              </View>
              <Text style={st.assetName}>{v.name}</Text>
              {detailLoading ? (
                <LoadingDots color={colors.primary} size={8} style={{ marginTop: 8 }}   />
              ) : (
                <Text style={st.bigPrice}>{formatApy(displayNetApy)}</Text>
              )}
              {apyDelta != null && (
                <View style={st.changeLine}>
                  <Text style={[st.changeText, isPositive ? st.green : st.red]}>
                    {isPositive ? '↗' : '↘'} {isPositive ? '+' : '−'}
                    {Math.abs(apyDelta).toFixed(2)}%
                  </Text>
                  <Text style={st.changeMuted}>{formatChartTimeframe(t, timeframe)}</Text>
                </View>
              )}
              {!apyDelta && (
                <Text style={st.changeMuted}>
                  {appliesServiceFee ? t('crypto.earnYourNetApy') : t('crypto.earnNetApy')}
                </Text>
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
              <Text style={st.balanceLabel}>{t('crypto.balance')}</Text>
              <Text style={st.balanceValue}>
                {money.value(balanceUsd)}
              </Text>
              <Text style={st.balanceSub}>
                {formatHoldings(tokenBalance, v.asset.symbol)}
              </Text>
              <View style={st.balanceDivider} />
              <View style={st.balanceFooter}>
                <Text style={st.balanceFooterLabel}>{t('crypto.earnNetApy')}</Text>
                <Text style={[st.balanceFooterVal, st.green]}>{formatApy(displayNetApy)}</Text>
              </View>
            </View>

            <View style={st.noteCard}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
              <Text style={st.noteText}>{t('crypto.earnInAppNote')}</Text>
            </View>

            <Text style={st.sectionTitle}>{t('crypto.keyStats')}</Text>
            <View style={st.statsCard}>
              <StatRow
                label={appliesServiceFee ? t('crypto.earnYourNetApy') : t('crypto.earnNetApy')}
                value={formatApy(displayNetApy)}
              />
              <StatRow label={t('crypto.earnTvl')} value={money.compact(v.totalAssetsUsd)} />
              <StatRow label={t('crypto.earnFee')} value={formatFee(v.fee)} />
              {appliesServiceFee && (
                <StatRow
                  label={t('crypto.earnServiceFee')}
                  value={t('crypto.earnServiceFeeValue', { fee: formatEarnFeePercent() })}
                  sub={t('crypto.earnServiceFeeSub')}
                />
              )}
              <StatRow label={t('crypto.earnSharePrice')} value={money.price(v.sharePriceUsd)} />
            </View>

            <Text style={st.chartSourceNote}>{t('crypto.earnSourceNote')}</Text>

            <Text style={st.sectionTitle}>{t('crypto.about')}</Text>
            <Text style={st.aboutText}>
              {v.description?.trim() || t('crypto.earnAboutFallback', { name: v.name, symbol: v.asset.symbol })}
            </Text>
          </ScrollView>

          <View style={[st.actionBar, { paddingBottom: insets.bottom + 10 }]}>
            <View style={st.actionRow}>
              <TouchableOpacity
                style={[st.sellBtn, !hasDeposit && st.sellBtnDisabled]}
                onPress={() => setActionSheet('withdraw')}
                disabled={!hasDeposit}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="remove-circle-outline"
                  size={20}
                  color={hasDeposit ? colors.text : colors.textFaint}
                />
                <Text style={[st.sellBtnText, !hasDeposit && st.disabledText]}>
                  {t('crypto.earnWithdrawAction')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={st.buyBtn}
                onPress={() => setActionSheet('deposit')}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
                <Text style={st.buyBtnText}>{t('crypto.earnDepositAction')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <EarnActionSheet
            visible={actionSheet !== null}
            action={actionSheet ?? 'deposit'}
            vault={v}
            depositAddress={position.depositAddress || depositRouting.depositAddress || v.address}
            usesFeeWrapper={depositRouting.usesFeeWrapper || position.usesFeeWrapper}
            vaultBalance={position.assetsFormatted}
            scaAddress={scaAddress}
            executeMorphoDeposit={wallet.executeMorphoDeposit}
            executeMorphoWithdraw={wallet.executeMorphoWithdraw}
            estimateMorphoDepositGasUsdc={wallet.estimateMorphoDepositGasUsdc}
            estimateMorphoWithdrawGasUsdc={wallet.estimateMorphoWithdrawGasUsdc}
            estimateGasReserve={wallet.estimateUsdcGasReserve}
            isExecutingEarn={wallet.isExecutingEarn}
            onClose={() => setActionSheet(null)}
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
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
    logoWrap: { width: 44, height: 44, marginBottom: 6 },
    assetName: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    bigPrice: { color: c.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
    changeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    changeText: { fontSize: 14, fontWeight: '600' },
    changeMuted: { color: c.textMuted, fontSize: 14 },
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
