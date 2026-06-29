/**
 * StockDetailModal
 *
 * Full-screen asset detail aligned with {@link TokenDetailModal}:
 * Dinari price + live quote for trading · underlying ticker chart (Yahoo)
 * · CoinGecko about when available · fixed Sell / Buy bar.
 */
import React, { useEffect, useMemo, useState } from 'react';
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

import StockTradeSheet, { TradeSide } from './StockTradeSheet';
import DinariGateOverlay from '../components/DinariGateOverlay';
import StockLogo from '../components/StockLogo';
import { StockItem, useDinariGate } from '../hooks/useDinari';
import { stockGeckoId } from '../config/dinariStocks';
import { getStockPrice, getStockQuote, DinariStockQuote } from '../../../lib/api/dinari/client';
import PriceChart from '../../crypto/components/PriceChart';
import { TIMEFRAMES, Timeframe, useTokenDetail } from '../../crypto/hooks/useTokenDetail';
import { formatChartTimeframe } from '../../crypto/utils/tokenDisplay';
import { useStockChart } from '../hooks/useStockChart';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useFavoritesStore } from '../../crypto/store/useFavoritesStore';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 200;

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

function formatHoldings(n: number, symbol: string): string {
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.0001) return `${n.toExponential(2)} ${symbol}`;
  if (n < 1) return `${n.toFixed(6)} ${symbol}`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${symbol}`;
}

/** Scale CoinGecko history so the last point matches the live Dinari price. */
function normalizeChartToPrice(prices: number[], targetPrice: number): number[] {
  if (prices.length < 2 || targetPrice <= 0) return prices;
  const last = prices[prices.length - 1];
  if (!Number.isFinite(last) || last <= 0) return prices;
  const scale = targetPrice / last;
  return prices.map((p) => p * scale);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

interface Props {
  visible: boolean;
  stock: StockItem | null;
  usdcBalance: number;
  scaAddress: string;
  signTypedData: UseKuraCardWalletReturn['signTypedData'];
  ensureCanTrade?: (side: TradeSide) => Promise<boolean>;
  resumeTradeSide?: TradeSide | null;
  onResumeTradeHandled?: () => void;
  dinariGateVisible?: boolean;
  gate?: ReturnType<typeof useDinariGate>;
  onDinariGateClose?: () => void;
  onDinariGateReady?: () => void;
  onClose: () => void;
  onTraded?: () => void;
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

export default function StockDetailModal({
  visible,
  stock,
  usdcBalance,
  scaAddress,
  signTypedData,
  ensureCanTrade,
  resumeTradeSide,
  onResumeTradeHandled,
  dinariGateVisible = false,
  gate,
  onDinariGateClose,
  onDinariGateReady,
  onClose,
  onTraded,
}: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const st = useStyles();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const [tradeSide, setTradeSide] = useState<TradeSide | null>(null);
  const [quote, setQuote] = useState<DinariStockQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteLoaded, setQuoteLoaded] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [timeframe, setTimeframe] = useState<Timeframe>('24H');

  const geckoId = stock ? stockGeckoId(stock.symbol) : null;
  const chartActive = visible && !!stock?.symbol;

  const { prices, stats: chartStats, chartLoading } = useStockChart(
    stock?.symbol ?? null,
    timeframe,
    chartActive,
  );
  const { stats: geckoStats } = useTokenDetail(visible && geckoId ? geckoId : null, '24H');

  const starred = stock ? favorites.includes(stock.symbol) : false;

  async function openTrade(side: TradeSide) {
    if (ensureCanTrade) {
      const ok = await ensureCanTrade(side);
      if (!ok) return;
    }
    setTradeSide(side);
  }

  useEffect(() => {
    if (!visible || !resumeTradeSide) return;
    setTradeSide(resumeTradeSide);
    onResumeTradeHandled?.();
  }, [visible, resumeTradeSide, onResumeTradeHandled]);

  useEffect(() => {
    if (!visible || !stock) {
      setQuote(null);
      setQuoteLoading(false);
      setQuoteLoaded(false);
      return;
    }
    let active = true;
    setQuote(null);
    setQuoteLoading(true);
    setQuoteLoaded(false);
    getStockQuote(stock.id)
      .then((q) => {
        if (!active) return;
        setQuote(q);
        setQuoteLoaded(true);
      })
      .catch(() => {
        if (active) setQuoteLoaded(true);
      })
      .finally(() => {
        if (active) setQuoteLoading(false);
      });
    return () => { active = false; };
  }, [visible, stock?.id]);

  useEffect(() => {
    if (!visible || !stock) {
      setLivePrice(null);
      setPriceLoading(false);
      return;
    }
    let active = true;
    setLivePrice(null);
    setPriceLoading(true);
    getStockPrice(stock.id)
      .then((p) => {
        if (!active) return;
        const next = typeof p.price === 'number' ? p.price : Number(p.price) || 0;
        setLivePrice(next > 0 ? next : null);
      })
      .catch(() => { /* Dinari price is best-effort */ })
      .finally(() => {
        if (active) setPriceLoading(false);
      });
    return () => { active = false; };
  }, [visible, stock?.id]);

  const displayPrice = livePrice ?? 0;
  const tradeStock = stock && displayPrice > 0 ? { ...stock, price: displayPrice } : stock;

  const normalizedChart = useMemo(
    () => normalizeChartToPrice(prices, displayPrice),
    [prices, displayPrice],
  );

  const change24h = useMemo(() => {
    if (chartStats?.change24hPercent != null && Number.isFinite(chartStats.change24hPercent)) {
      return chartStats.change24hPercent;
    }
    if (normalizedChart.length < 2) return null;
    const first = normalizedChart[0];
    const last = normalizedChart[normalizedChart.length - 1];
    if (first <= 0) return null;
    return ((last - first) / first) * 100;
  }, [chartStats?.change24hPercent, normalizedChart]);

  const chartUp = normalizedChart.length >= 2
    ? normalizedChart[normalizedChart.length - 1] >= normalizedChart[0]
    : (change24h ?? 0) >= 0;

  const chartMin = normalizedChart.length ? Math.min(...normalizedChart) : 0;
  const chartMax = normalizedChart.length ? Math.max(...normalizedChart) : 0;

  const geckoScale = useMemo(() => {
    if (displayPrice <= 0) return 1;
    const ref = chartStats?.referencePrice;
    if (ref != null && ref > 0) return displayPrice / ref;
    if (prices.length < 1) return 1;
    const last = prices[prices.length - 1];
    if (!Number.isFinite(last) || last <= 0) return 1;
    return displayPrice / last;
  }, [displayPrice, chartStats?.referencePrice, prices]);

  const hasLiveBook = quote?.bid != null || quote?.ask != null;
  const showLiveQuoteUnavailable = quoteLoaded && !quoteLoading && displayPrice > 0 && !hasLiveBook;

  if (!stock) return null;

  const holdingValue = stock.holdings * displayPrice;
  const canSell = stock.holdings > 0;
  const isPositive = (change24h ?? 0) >= 0;
  const dollarChange = change24h != null && displayPrice > 0
    ? displayPrice - displayPrice / (1 + change24h / 100)
    : null;
  const holdingChange24h = change24h != null
    ? holdingValue - holdingValue / (1 + change24h / 100)
    : null;

  const aboutText = geckoStats?.description ? stripHtml(geckoStats.description) : null;
  const rangeLow = chartStats?.low24h != null ? chartStats.low24h * geckoScale : null;
  const rangeHigh = chartStats?.high24h != null ? chartStats.high24h * geckoScale : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={st.root}>
        <View style={[st.topBar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity onPress={onClose} style={st.iconBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={st.topTitle}>{stock.symbol}</Text>
          <View style={st.topRight}>
            <TouchableOpacity
              onPress={() => toggleFavorite(stock.symbol)}
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
              <StockLogo symbol={stock.symbol} size={44} />
            </View>
            <Text style={st.assetName}>{stock.name}</Text>
            <Text style={st.bigPrice}>
              {priceLoading ? '—' : displayPrice > 0 ? money.price(displayPrice) : '—'}
            </Text>
            {change24h != null && dollarChange != null && (
              <View style={st.changeLine}>
                <Text style={[st.changeText, isPositive ? st.green : st.red]}>
                  {isPositive ? '+' : '-'}{money.compact(Math.abs(dollarChange))}
                </Text>
                <Text style={[st.changeText, isPositive ? st.green : st.red]}>
                  {isPositive ? '↗' : '↘'} {Math.abs(change24h).toFixed(2)}%
                </Text>
                <Text style={st.changeMuted}>{t('crypto.last24Hours')}</Text>
              </View>
            )}
          </View>

          <>
            <View style={st.chartWrap}>
                <PriceChart
                  prices={normalizedChart}
                  width={SCREEN_W}
                  height={CHART_H}
                  loading={chartLoading}
                  positive={chartUp}
                />
                {normalizedChart.length >= 2 && (
                  <>
                    <Text style={[st.chartLabel, { top: 6 }]}>{money.price(chartMax)}</Text>
                    <Text style={[st.chartLabel, { bottom: 6 }]}>{money.price(chartMin)}</Text>
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
          </>

          <View style={st.balanceCard}>
            <Text style={st.balanceLabel}>{t('crypto.balance')}</Text>
            <Text style={st.balanceValue}>{money.value(holdingValue)}</Text>
            <Text style={st.balanceSub}>{formatHoldings(stock.holdings, stock.symbol)}</Text>
            <View style={st.balanceDivider} />
            <View style={st.balanceFooter}>
              <Text style={st.balanceFooterLabel}>{t('crypto.change24h')}</Text>
              {change24h != null && holdingChange24h != null ? (
                <Text style={[st.balanceFooterVal, isPositive ? st.green : st.red]}>
                  {isPositive ? '+' : '-'}{money.compact(Math.abs(holdingChange24h))}
                  {'  '}
                  {isPositive ? '↗' : '↘'} {Math.abs(change24h).toFixed(2)}%
                </Text>
              ) : (
                <Text style={st.balanceFooterVal}>—</Text>
              )}
            </View>
          </View>

          <View style={st.noteCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
            <Text style={st.noteText}>{t('crypto.stockTokenizedNote')}</Text>
          </View>

          <Text style={st.sectionTitle}>{t('crypto.stockLiveQuote')}</Text>
          <View style={st.statsCard}>
            <StatRow
              label={t('crypto.stockLastPrice')}
              value={priceLoading ? '—' : displayPrice > 0 ? money.price(displayPrice) : '—'}
            />
            <StatRow
              label={t('crypto.stockBid')}
              value={
                quoteLoading
                  ? '—'
                  : quote?.bid != null
                    ? money.price(quote.bid)
                    : '—'
              }
            />
            <StatRow
              label={t('crypto.stockAsk')}
              value={
                quoteLoading
                  ? '—'
                  : quote?.ask != null
                    ? money.price(quote.ask)
                    : '—'
              }
            />
            <StatRow
              label={t('crypto.stockSpread')}
              value={
                quoteLoading
                  ? '—'
                  : quote?.spread != null
                    ? money.price(quote.spread)
                    : '—'
              }
            />
          </View>
          {showLiveQuoteUnavailable && (
            <View style={st.quoteNoteCard}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
              <Text style={st.quoteNoteText}>{t('crypto.stockLiveQuoteUnavailable')}</Text>
            </View>
          )}

          {chartStats && (
            <>
              <Text style={st.sectionTitle}>{t('crypto.keyStats')}</Text>
              <View style={st.statsCard}>
                <StatRow
                  label={t('crypto.volume24h')}
                  value={chartStats.totalVolume != null
                    ? chartStats.totalVolume.toLocaleString('en-US', { maximumFractionDigits: 0 })
                    : '—'}
                />
                <RangeRow
                  label={t('crypto.range24h')}
                  low={rangeLow}
                  high={rangeHigh}
                  current={displayPrice}
                />
              </View>
              <Text style={st.chartSourceNote}>
                {t('crypto.stocksChartNote', { symbol: stock.symbol })}
              </Text>
            </>
          )}

          <Text style={st.sectionTitle}>{t('crypto.about')}</Text>
          <Text style={st.aboutText}>
            {aboutText ?? t('crypto.stocksAbout', { name: stock.name, symbol: stock.symbol })}
          </Text>
        </ScrollView>

        <View style={[st.actionBar, { paddingBottom: insets.bottom + 10 }]}>
          <View style={st.actionRow}>
            <TouchableOpacity
              style={[st.sellBtn, !canSell && st.sellBtnDisabled]}
              onPress={() => { void openTrade('sell'); }}
              disabled={!canSell}
              activeOpacity={0.85}
            >
              <Ionicons
                name="remove-circle-outline"
                size={20}
                color={canSell ? colors.text : colors.textFaint}
              />
              <Text style={[st.sellBtnText, !canSell && st.disabledText]}>{t('crypto.sell')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={st.buyBtn}
              onPress={() => { void openTrade('buy'); }}
              activeOpacity={0.85}
            >
              <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
              <Text style={st.buyBtnText}>{t('crypto.buy')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <StockTradeSheet
          visible={tradeSide !== null}
          side={tradeSide ?? 'buy'}
          stock={tradeStock}
          usdcBalance={usdcBalance}
          scaAddress={scaAddress}
          signTypedData={signTypedData}
          onClose={() => setTradeSide(null)}
          onTraded={onTraded}
        />

        {dinariGateVisible && gate && onDinariGateClose ? (
          <DinariGateOverlay
            gate={gate}
            onClose={onDinariGateClose}
            onReady={onDinariGateReady}
          />
        ) : null}
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
    quoteNoteCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      marginHorizontal: 16,
      marginTop: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    quoteNoteText: {
      flex: 1,
      color: c.textMuted,
      fontSize: 12,
      lineHeight: 17,
    },

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
