import LoadingDots from '../../../shared/components/LoadingDots';
/**
 * TokenDetailModal
 *
 * Full-screen, Revolut-style asset detail page:
 *   header · price + 24h change · price chart with timeframe selector ·
 *   balance card · key stats · about · fixed Swap bar.
 *
 * Tapping Swap opens a compact {@link TradeSheet}.
 */
import React, { useMemo, useState, useCallback, useEffect } from 'react';
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

import PriceChart from '../components/PriceChart';
import TokenLogo from '../components/TokenLogo';
import TradeSheet from './TradeSheet';
import { userFacingTransactionError } from '../../../lib/wallet/userFacingTransactionError';
import TokenDepositModal from './TokenDepositModal';
import TokenWithdrawModal from './TokenWithdrawModal';
import { useTokenDetail, TIMEFRAMES, Timeframe } from '../hooks/useTokenDetail';
import { formatChartTimeframe, getTokenLocalizedName } from '../utils/tokenDisplay';
import type { BluechipToken } from '../config/blueChips';
import { formatTokenQuantity } from '../../../shared/utils/formatQuantity';
import i18n from '../../../shared/locales/i18n';
import { isStablecoinSymbol, stablecoinPegKey } from '../config/portfolioAssetClasses';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useFavoritesStore } from '../store/useFavoritesStore';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 200;

// ─────────────────────────────────────────────────────────────────────────────
// Formatting helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatNumCompact(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(i18n.language, { month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

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

function RangeRow({
  label,
  low,
  high,
  current,
}: {
  label: string;
  low: number | null;
  high: number | null;
  current: number;
}) {
  const st = useStyles();
  const money = useMoneyFormat();
  if (low == null || high == null || high <= low) {
    return <StatRow label={label} value="—" />;
  }
  const frac = Math.min(1, Math.max(0, (current - low) / (high - low)));
  return (
    <View style={st.rangeWrap}>
      <Text style={st.statLabel}>{label}</Text>
      <View style={st.rangeTrack}>
        <View style={[st.rangeFill, { width: `${frac * 100}%` }]} />
        <View style={[st.rangeMarker, { left: `${frac * 100}%` }]} />
      </View>
      <View style={st.rangeLabels}>
        <Text style={st.rangeEnd}>{money.price(low)}</Text>
        <Text style={st.rangeEnd}>{money.price(high)}</Text>
      </View>
    </View>
  );
}

function TransferGlyph({ direction }: { direction: 'deposit' | 'withdraw' }) {
  const st = useStyles();
  const { colors } = useTheme();
  return (
    <View style={st.transferGlyph}>
      <Ionicons
        name={direction === 'deposit' ? 'arrow-down' : 'arrow-up'}
        size={17}
        color={colors.text}
      />
      <View style={st.transferGlyphBar} />
    </View>
  );
}

function BalanceCardAction({
  direction,
  label,
  onPress,
  disabled,
}: {
  direction: 'deposit' | 'withdraw';
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const st = useStyles();
  return (
    <TouchableOpacity
      style={st.balanceAction}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <View style={[st.balanceActionIconBox, disabled && st.balanceActionIconBoxDisabled]}>
        <TransferGlyph direction={direction} />
      </View>
      <Text style={[st.balanceActionLabel, disabled && st.balanceActionLabelDisabled]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TokenDetailModal
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  token: BluechipToken | null;
  tokenPrice: number;
  tokenChange24h: number;
  usdcBalance: number;
  tokenHoldings: number;
  scaAddress: string;
  onClose: () => void;
  executeSwap: UseKuraCardWalletReturn['executeSwap'];
  estimateSwapGasUsdc: UseKuraCardWalletReturn['estimateSwapGasUsdc'];
  estimateGasReserve: UseKuraCardWalletReturn['estimateUsdcGasReserve'];
  isExecutingSwap: boolean;
  isSending: boolean;
  sendToken: UseKuraCardWalletReturn['sendToken'];
  sendNativeEth: UseKuraCardWalletReturn['sendNativeEth'];
  wrapEthToWeth: UseKuraCardWalletReturn['wrapEthToWeth'];
  onTraded?: () => void;
  onWithdrawn?: () => void;
}

export default function TokenDetailModal({
  visible,
  token,
  tokenPrice,
  tokenChange24h,
  usdcBalance,
  tokenHoldings,
  scaAddress,
  onClose,
  executeSwap,
  estimateSwapGasUsdc,
  estimateGasReserve,
  isExecutingSwap,
  isSending,
  sendToken,
  sendNativeEth,
  wrapEthToWeth,
  onTraded,
  onWithdrawn,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const money = useMoneyFormat();

  const [timeframe, setTimeframe] = useState<Timeframe>('24H');
  const [swapOpen, setSwapOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [wrapError, setWrapError] = useState('');

  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const starred = token ? favorites.includes(token.symbol) : false;

  const { prices, chartLoading, stats } = useTokenDetail(
    visible && token ? token.geckoId : null,
    timeframe,
    visible && token ? token.aboutGeckoId : null,
  );

  const isPositive = tokenChange24h >= 0;
  const dollarChange = useMemo(() => {
    const prev = tokenPrice / (1 + tokenChange24h / 100);
    return tokenPrice - prev;
  }, [tokenPrice, tokenChange24h]);

  // Chart trend is per-timeframe (first→last), independent of the 24h badge.
  const chartUp = prices.length >= 2 ? prices[prices.length - 1] >= prices[0] : isPositive;
  const chartMin = prices.length ? Math.min(...prices) : 0;
  const chartMax = prices.length ? Math.max(...prices) : 0;

  const holdingValue = tokenHoldings * tokenPrice;
  const holdingChange24h = holdingValue - holdingValue / (1 + tokenChange24h / 100);

  useEffect(() => {
    if (visible && token?.symbol === 'ETH' && token.baseAddress === null) {
      setSwapOpen(false);
    }
  }, [visible, token?.symbol, token?.baseAddress]);

  const handleWithdraw = useCallback(
    async (toAddress: string, amount: number) => {
      if (token?.symbol === 'ETH' && token.baseAddress === null) {
        return sendNativeEth(toAddress, amount);
      }
      if (!token?.baseAddress) throw new Error('Token not supported for on-chain transfer.');
      return sendToken(token.baseAddress, token.decimals, toAddress, amount);
    },
    [token, sendToken, sendNativeEth],
  );

  const handleWrapToWeth = useCallback(async () => {
    if (tokenHoldings <= 0) return;
    setWrapError('');
    try {
      await wrapEthToWeth(tokenHoldings);
      onTraded?.();
    } catch (err) {
      setWrapError(userFacingTransactionError(err));
    }
  }, [tokenHoldings, wrapEthToWeth, onTraded, t]);

  if (!token) return null;

  const isNativeEth = token.symbol === 'ETH' && token.baseAddress === null;
  const isCash = !token.swappable && !isNativeEth;
  const isStable = isStablecoinSymbol(token.symbol);
  const aboutText = stats?.description ? stripHtml(stats.description) : null;
  const canWithdraw = tokenHoldings > 0 && (isNativeEth || !!token.baseAddress);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={st.root}>
        {/* ── Top bar ── */}
        <View style={[st.topBar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={onClose} style={st.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.topTitle}>{token.symbol}</Text>
          <View style={st.topRight}>
            <TouchableOpacity
              onPress={() => toggleFavorite(token.symbol)}
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

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* ── Price header ── */}
          <View style={st.priceHeader}>
            <View style={st.logoWrap}>
              <TokenLogo token={token} size={44} />
              {token.badge && (
                <View style={[st.logoBadge, { backgroundColor: token.color }]}>
                  <Text style={st.logoBadgeText}>{token.badge}</Text>
                </View>
              )}
            </View>
            <Text style={st.assetName}>{getTokenLocalizedName(token)}</Text>
            <Text style={st.bigPrice}>{money.price(tokenPrice)}</Text>
            {!isStable ? (
              <View style={st.changeLine}>
                <Text style={[st.changeText, isPositive ? st.green : st.red]}>
                  {isPositive ? '+' : '-'}{money.compact(Math.abs(dollarChange))}
                </Text>
                <Text style={[st.changeText, isPositive ? st.green : st.red]}>
                  {isPositive ? '↗' : '↘'} {Math.abs(tokenChange24h).toFixed(2)}%
                </Text>
                <Text style={st.changeMuted}>{t('crypto.last24Hours')}</Text>
              </View>
            ) : null}
          </View>

          {/* ── Chart ── */}
          <View style={st.chartWrap}>
            <PriceChart
              prices={prices}
              width={SCREEN_W}
              height={CHART_H}
              loading={chartLoading}
              positive={chartUp}
            />
            {prices.length >= 2 && (
              <>
                <Text style={[st.chartLabel, { top: 6 }]}>{money.price(chartMax)}</Text>
                <Text style={[st.chartLabel, { bottom: 6 }]}>{money.price(chartMin)}</Text>
              </>
            )}
          </View>

          {/* ── Timeframe selector ── */}
          <View style={st.tfRow}>
            {TIMEFRAMES.map((tf) => {
              const active = tf === timeframe;
              return (
                <TouchableOpacity
                  key={tf}
                  onPress={() => setTimeframe(tf)}
                  style={[st.tfBtn, active && st.tfBtnActive]}
                  activeOpacity={0.7}
                >
                  <Text style={[st.tfText, active && st.tfTextActive]}>
                    {formatChartTimeframe(t, tf)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Balance card ── */}
          <View style={st.balanceCard}>
            <View style={st.balanceCardTop}>
              <View style={st.balanceCardMain}>
                <Text style={st.balanceLabel}>{t('crypto.balance')}</Text>
                <Text style={st.balanceValue}>{money.compact(holdingValue)}</Text>
                <Text style={st.balanceSub}>
                  {formatTokenQuantity(tokenHoldings, token.displayName)}
                </Text>
              </View>
              <View style={st.balanceActions}>
                <BalanceCardAction
                  direction="deposit"
                  label={t('crypto.deposit')}
                  onPress={() => setDepositOpen(true)}
                />
                <BalanceCardAction
                  direction="withdraw"
                  label={t('crypto.withdraw')}
                  onPress={() => setWithdrawOpen(true)}
                  disabled={!canWithdraw}
                />
              </View>
            </View>
            {!isStable ? (
              <>
                <View style={st.balanceDivider} />
                <View style={st.balanceFooter}>
                  <Text style={st.balanceFooterLabel}>{t('crypto.change24h')}</Text>
                  <Text style={[st.balanceFooterVal, isPositive ? st.green : st.red]}>
                    {isPositive ? '+' : '-'}{money.compact(Math.abs(holdingChange24h))}
                    {'  '}
                    {isPositive ? '↗' : '↘'} {Math.abs(tokenChange24h).toFixed(2)}%
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {/* ── Stablecoin note (cash token only) ── */}
          {(isCash || isStable) && (
            <View style={st.noteCard}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
              <Text style={st.noteText}>
                {isStable
                  ? t('crypto.stablecoinNote', {
                      symbol: token.displayName,
                      peg: t(`crypto.${stablecoinPegKey(token.symbol)}`),
                    })
                  : t('crypto.purchaseUnavailableNote')}
              </Text>
            </View>
          )}

          {isNativeEth && (
            <View style={st.noteCard}>
              <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
              <Text style={st.noteText}>{t('crypto.nativeEthNote')}</Text>
            </View>
          )}

          {/* ── Key stats ── */}
          <Text style={st.sectionTitle}>{t('crypto.keyStats')}</Text>
          <View style={st.statsCard}>
            <StatRow
              label={t('crypto.marketRank')}
              value={stats?.marketCapRank ? `#${stats.marketCapRank}` : '—'}
            />
            <StatRow label={t('crypto.marketCap')} value={money.compact(stats?.marketCap ?? null)} />
            <StatRow label={t('crypto.volume24h')} value={money.compact(stats?.totalVolume ?? null)} />
            <StatRow
              label={t('crypto.circulatingSupply')}
              value={formatNumCompact(stats?.circulatingSupply ?? null)}
              sub={
                stats?.circulatingSupply && stats?.maxSupply
                  ? t('crypto.percentOfMaxSupply', {
                      percent: ((stats.circulatingSupply / stats.maxSupply) * 100).toFixed(0),
                    })
                  : undefined
              }
            />
            <StatRow
              label={t('crypto.allTimeHigh')}
              value={money.price(stats?.ath ?? 0)}
              sub={formatDate(stats?.athDate ?? null) || undefined}
            />
            {!isStable ? (
              <>
                <RangeRow
                  label={t('crypto.range24h')}
                  low={stats?.low24h ?? null}
                  high={stats?.high24h ?? null}
                  current={tokenPrice}
                />
                <RangeRow
                  label={t('crypto.range1y')}
                  low={stats?.low52w ?? null}
                  high={stats?.high52w ?? null}
                  current={tokenPrice}
                />
              </>
            ) : null}
          </View>

          {/* ── About ── */}
          {aboutText && (
            <>
              <Text style={st.sectionTitle}>{t('crypto.about')}</Text>
              <Text style={st.aboutText}>{aboutText}</Text>
            </>
          )}
        </ScrollView>

        {/* ── Fixed action bar ── */}
        {isNativeEth ? (
          <View style={[st.actionBar, { paddingBottom: insets.bottom + 10 }]}>
            {wrapError ? (
              <Text style={[st.wrapError, { textAlign: 'center', marginBottom: 10 }]}>{wrapError}</Text>
            ) : null}
            <TouchableOpacity
              style={[st.buyBtn, st.buyBtnFull, (tokenHoldings <= 0 || isSending) && st.buyBtnDisabled]}
              onPress={() => void handleWrapToWeth()}
              disabled={tokenHoldings <= 0 || isSending}
              activeOpacity={0.85}
            >
              {isSending ? (
                <LoadingDots compact color="#FFFFFF" size={6}    />
              ) : (
                <>
                  <Ionicons name="swap-horizontal-outline" size={20} color="#FFFFFF" />
                  <Text style={st.buyBtnText}>{t('crypto.wrapToWeth')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : !isCash ? (
          <View style={[st.actionBar, { paddingBottom: insets.bottom + 10 }]}>
            <TouchableOpacity
              style={st.swapBtn}
              onPress={() => setSwapOpen(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="swap-vertical" size={20} color="#FFFFFF" />
              <Text style={st.swapBtnText}>{t('crypto.swap')}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TokenDepositModal
          visible={depositOpen}
          token={token}
          scaAddress={scaAddress}
          onClose={() => setDepositOpen(false)}
        />

        <TokenWithdrawModal
          visible={withdrawOpen}
          token={token}
          tokenHoldings={tokenHoldings}
          isSending={isSending}
          onClose={() => setWithdrawOpen(false)}
          onWithdraw={handleWithdraw}
          onWithdrawn={onWithdrawn}
        />

        {/* ── Trade sheet (swappable tokens only) ── */}
        {!isCash && !isNativeEth && (
          <TradeSheet
            visible={swapOpen}
            token={token}
            tokenPrice={tokenPrice}
            usdcBalance={usdcBalance}
            tokenHoldings={tokenHoldings}
            scaAddress={scaAddress}
            executeSwap={executeSwap}
            estimateSwapGasUsdc={estimateSwapGasUsdc}
            estimateGasReserve={estimateGasReserve}
            isExecutingSwap={isExecutingSwap}
            onClose={() => setSwapOpen(false)}
            onTraded={onTraded}
          />
        )}
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },

    // Top bar
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 8,
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

    // Price header
    priceHeader: { paddingHorizontal: 20, paddingTop: 8, gap: 6 },
    logoWrap: {
      width: 44,
      height: 44,
      marginBottom: 6,
      position: 'relative',
    },
    logoBadge: {
      position: 'absolute',
      bottom: -2,
      right: -4,
      borderRadius: 6,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderWidth: 2,
      borderColor: c.background,
    },
    logoBadgeText: { color: '#FFFFFF', fontSize: 7, fontWeight: '800' },
    assetName: { color: c.textMuted, fontSize: 15, fontWeight: '600' },
    bigPrice: { color: c.text, fontSize: 34, fontWeight: '800', letterSpacing: -1 },
    changeLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    changeText: { fontSize: 14, fontWeight: '600' },
    changeMuted: { color: c.textMuted, fontSize: 14 },
    green: { color: '#10B981' },
    red: { color: '#EF4444' },

    // Chart
    chartWrap: { marginTop: 16, height: CHART_H, position: 'relative' },
    chartLabel: {
      position: 'absolute',
      right: 12,
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },

    // Timeframe selector
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

    // Balance card
    balanceCard: {
      marginHorizontal: 16,
      marginTop: 22,
      backgroundColor: c.surfaceAlt,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 18,
    },
    balanceCardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    balanceCardMain: { flex: 1, minWidth: 0 },
    balanceActions: { flexDirection: 'row', gap: 14, paddingTop: 2 },
    balanceAction: { alignItems: 'center', gap: 8, width: 58 },
    balanceActionIconBox: {
      width: 52,
      height: 52,
      borderRadius: 14,
      backgroundColor: c.surfaceInput,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    balanceActionIconBoxDisabled: { opacity: 0.45 },
    balanceActionLabel: { color: c.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
    balanceActionLabelDisabled: { color: c.textFaint },
    transferGlyph: { alignItems: 'center', gap: 3 },
    transferGlyphBar: {
      width: 18,
      height: 2,
      borderRadius: 1,
      backgroundColor: c.text,
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

    // Stablecoin note card
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

    // Sections
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

    // Range row
    rangeWrap: {
      paddingVertical: 14,
      gap: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    rangeTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: c.border,
      position: 'relative',
      marginTop: 4,
    },
    rangeFill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: 2,
      backgroundColor: c.primary,
    },
    rangeMarker: {
      position: 'absolute',
      top: -3,
      width: 10,
      height: 10,
      borderRadius: 5,
      marginLeft: -5,
      backgroundColor: c.text,
    },
    rangeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    rangeEnd: { color: c.textMuted, fontSize: 12, fontWeight: '600' },

    // About
    aboutText: {
      color: c.textMuted,
      fontSize: 14,
      lineHeight: 21,
      paddingHorizontal: 20,
    },

    // Action bar
    actionBar: {
      paddingHorizontal: 16,
      paddingTop: 12,
      backgroundColor: c.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    actionRow: { flexDirection: 'row', gap: 12 },
    swapBtn: {
      height: 50,
      borderRadius: 16,
      backgroundColor: c.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    swapBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
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
    buyBtnFull: { flex: undefined, width: '100%' as const },
    buyBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    buyBtnDisabled: { opacity: 0.5 },
    disabledText: { color: c.textFaint },
    wrapError: { color: c.danger, fontSize: 13 },
  });
}
