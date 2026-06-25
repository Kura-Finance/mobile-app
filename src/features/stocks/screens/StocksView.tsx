/**
 * StocksView
 *
 * Content for the Discover → "US Stock" tab. List UX mirrors the crypto tab
 * (favorites + watchlist sections). Tapping a stock opens
 * {@link StockDetailModal}. Buy/Sell gate on Dinari entity + account via
 * {@link ensureCanTrade} → {@link DinariGateOverlay} inside stock detail when needed.
 *
 * Portfolio total is shown by {@link PortfolioScreen} (crypto + stocks combined).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { isFeaturedStockSymbol } from '../config/dinariStocks';
import { useDinariGate, type StockItem } from '../hooks/useDinari';
import { useDinariWaitlistJoin } from '../hooks/useDinariWaitlistJoin';
import StockLogo from '../components/StockLogo';
import StockDetailModal from '../modals/StockDetailModal';
import { useFavoritesStore } from '../../crypto/store/useFavoritesStore';
import LegalDisclaimer from '../../../shared/components/LegalDisclaimer';
import LoadingDots from '../../../shared/components/LoadingDots';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';

import type { AssetClass } from '../../crypto/components/AssetClassToggle';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

function formatHoldings(n: number, symbol: string): string {
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.001) return `${n.toExponential(2)} ${symbol}`;
  if (n < 1) return `${n.toFixed(4)} ${symbol}`;
  if (n < 1000) return `${n.toFixed(2)} ${symbol}`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${symbol}`;
}

interface Props {
  assetClass: AssetClass;
  favoritesOnly?: boolean;
  scaAddress: string;
  usdcBalance: number;
  signTypedData: UseKuraCardWalletReturn['signTypedData'];
  gate: ReturnType<typeof useDinariGate>;
  stocks: StockItem[];
  stocksLoading: boolean;
  stocksRefreshing: boolean;
  stocksError: string | null;
  onRefresh: () => void;
  externalSelectedStock?: StockItem | null;
  onExternalSelectedStockHandled?: () => void;
}

function SectionDivider({ label }: { label: string }) {
  const st = useStyles();
  return (
    <View style={st.dividerWrap}>
      <View style={st.dividerLine} />
      <Text style={st.dividerLabel}>{label}</Text>
      <View style={st.dividerLine} />
    </View>
  );
}

function StockRow({ item, onPress }: { item: StockItem; onPress: (s: StockItem) => void }) {
  const { colors } = useTheme();
  const st = useStyles();
  const money = useMoneyFormat();
  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const hasHoldings = item.holdings > 0;
  const isFav = favorites.includes(item.symbol);

  return (
    <TouchableOpacity
      style={[st.row, !hasHoldings && !isFav && st.rowDimmed]}
      onPress={() => onPress(item)}
      activeOpacity={0.65}
    >
      <StockLogo symbol={item.symbol} size={44} />
      <View style={st.mid}>
        <View style={st.nameRow}>
          <Text style={st.symbol}>{item.symbol}</Text>
        </View>
        <Text style={st.price}>
          {item.price > 0 ? money.price(item.price) : '—'}
        </Text>
      </View>
      <View style={st.right}>
        {hasHoldings ? (
          <>
            <Text style={st.value}>{money.compact(item.value)}</Text>
            <Text style={st.holdings}>{formatHoldings(item.holdings, item.symbol)}</Text>
          </>
        ) : (
          <Text style={st.noHoldings}>—</Text>
        )}
      </View>
      <TouchableOpacity
        style={st.starBtn}
        onPress={() => toggleFavorite(item.symbol)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.6}
      >
        <Ionicons
          name={isFav ? 'star' : 'star-outline'}
          size={18}
          color={isFav ? '#F5AC37' : colors.textFaint}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function StocksView({
  assetClass,
  favoritesOnly = false,
  scaAddress,
  usdcBalance,
  signTypedData,
  gate,
  stocks,
  stocksLoading,
  stocksRefreshing,
  stocksError,
  onRefresh,
  externalSelectedStock,
  onExternalSelectedStockHandled,
}: Props) {
  const { t } = useTranslation();
  const st = useStyles();
  const { colors } = useTheme();
  const favorites = useFavoritesStore((s) => s.favorites);

  const [selected, setSelected] = useState<StockItem | null>(null);
  const [showDinariGate, setShowDinariGate] = useState(false);
  const pendingTradeSideRef = useRef<'buy' | 'sell' | null>(null);
  const [resumeTradeSide, setResumeTradeSide] = useState<'buy' | 'sell' | null>(null);
  const waitlist = useDinariWaitlistJoin();

  useEffect(() => {
    if (assetClass === 'stock' && gate.state === 'idle') {
      void gate.resolve();
    }
  }, [assetClass, gate.state, gate.resolve]);

  useEffect(() => {
    if (externalSelectedStock) {
      setSelected(externalSelectedStock);
      onExternalSelectedStockHandled?.();
    }
  }, [externalSelectedStock, onExternalSelectedStockHandled]);

  const ensureCanTrade = useCallback(async (side: 'buy' | 'sell'): Promise<boolean> => {
    if (gate.state === 'ready') return true;

    pendingTradeSideRef.current = side;
    setShowDinariGate(true);

    const next = await gate.resolve();
    if (next === 'ready') {
      setShowDinariGate(false);
      pendingTradeSideRef.current = null;
      return true;
    }
    if (next === 'kyc' || next === 'connect' || next === 'unsupported' || next === 'waitlist') {
      return false;
    }
    setShowDinariGate(false);
    pendingTradeSideRef.current = null;
    return false;
  }, [gate]);

  const handleGateReady = useCallback(() => {
    const side = pendingTradeSideRef.current;
    pendingTradeSideRef.current = null;
    if (side) setResumeTradeSide(side);
  }, []);

  const favoriteStocks = useMemo(
    () => stocks.filter((s) => favorites.includes(s.symbol)),
    [stocks, favorites],
  );
  const otherStocks = useMemo(
    () =>
      stocks
        .filter(
          (s) =>
            !favorites.includes(s.symbol) &&
            (s.holdings > 0 || isFeaturedStockSymbol(s.symbol)),
        )
        .sort((a, b) => Number(b.holdings > 0) - Number(a.holdings > 0)),
    [stocks, favorites],
  );

  const unsupportedMessage = gate.error
    ? t('crypto.dinariUnavailableBody', { error: gate.error })
    : t('crypto.dinariComingSoonBody');

  return (
    <View style={st.flex}>
      {stocksError && (
        <View style={st.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
          <Text style={st.errorText}>{stocksError}</Text>
        </View>
      )}

      {gate.state === 'waitlist' && (
        <View style={st.waitlistBox}>
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          <View style={st.waitlistCopy}>
            <Text style={st.waitlistTitle}>{t('crypto.dinariWaitlistTitle')}</Text>
            <Text style={st.waitlistBody}>{t('crypto.dinariWaitlistBody')}</Text>
          </View>
          <TouchableOpacity
            onPress={() => { void waitlist.handleJoin(); }}
            disabled={waitlist.joined || waitlist.submitting || waitlist.checking || !waitlist.backendAvailable}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
          >
            <Text style={[st.waitlistCta, (waitlist.joined || waitlist.submitting) && st.waitlistCtaMuted]}>
              {waitlist.joined ? t('card.notifyJoined') : t('crypto.dinariWaitlistCta')}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {gate.state === 'unsupported' && (
        <View style={st.errorBox}>
          <Ionicons name="time-outline" size={15} color={colors.danger} />
          <Text style={st.errorText}>{unsupportedMessage}</Text>
          <TouchableOpacity onPress={() => { void gate.resolve(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={st.retryText}>{t('crypto.dinariRetry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={st.listHost}>
        <View style={st.card}>
          <View style={st.colHeader}>
            <Text style={st.colLabel}>{t('crypto.colAsset')}</Text>
            <Text style={[st.colLabel, { textAlign: 'right' }]}>{t('crypto.colHoldings')}</Text>
          </View>

          <ScrollView
            style={st.listScroll}
            contentContainerStyle={st.listScrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={stocksRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
          >
            {stocksLoading && stocks.length === 0 ? (
              <View style={st.loadingRow}>
                <LoadingDots color={colors.textMuted} size={8} />
              </View>
            ) : favoritesOnly ? (
              favoriteStocks.length > 0 ? (
                favoriteStocks.map((item) => (
                  <StockRow key={item.id} item={item} onPress={setSelected} />
                ))
              ) : (
                <View style={st.emptyFavorites}>
                  <Text style={st.emptyFavoritesText}>{t('crypto.favoritesEmpty')}</Text>
                </View>
              )
            ) : (
              <>
                {favoriteStocks.length > 0 && (
                  <>
                    <SectionDivider label={t('crypto.favorites')} />
                    {favoriteStocks.map((item) => (
                      <StockRow key={item.id} item={item} onPress={setSelected} />
                    ))}
                  </>
                )}

                {otherStocks.length > 0 && (
                  <>
                    {favoriteStocks.length > 0 && (
                      <SectionDivider label={t('crypto.watchlist')} />
                    )}
                    {otherStocks.map((item) => (
                      <StockRow key={item.id} item={item} onPress={setSelected} />
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>

      <View style={st.footer}>
        <Text style={st.sourceNote}>{t('crypto.stocksSourceNote')}</Text>
        <LegalDisclaimer variant="securities" style={st.legalFooter} />
      </View>

      <StockDetailModal
        visible={!!selected}
        stock={selected}
        usdcBalance={usdcBalance}
        scaAddress={scaAddress}
        signTypedData={signTypedData}
        ensureCanTrade={ensureCanTrade}
        resumeTradeSide={resumeTradeSide}
        onResumeTradeHandled={() => setResumeTradeSide(null)}
        dinariGateVisible={showDinariGate}
        gate={gate}
        onDinariGateClose={() => {
          pendingTradeSideRef.current = null;
          setShowDinariGate(false);
        }}
        onDinariGateReady={handleGateReady}
        onClose={() => setSelected(null)}
        onTraded={onRefresh}
      />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1 },

    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginBottom: 12,
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.2)',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    errorText: { color: c.danger, fontSize: 12, flex: 1 },
    retryText: { color: c.primary, fontSize: 12, fontWeight: '700' },
    emptyFavorites: {
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    emptyFavoritesText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },

    waitlistBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginHorizontal: 20,
      marginBottom: 12,
      backgroundColor: c.primarySoft,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.primarySoft,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    waitlistCopy: { flex: 1, gap: 4 },
    waitlistTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    waitlistBody: { color: c.textMuted, fontSize: 12, lineHeight: 17 },
    waitlistCta: { color: c.primary, fontSize: 12, fontWeight: '700', marginTop: 2 },
    waitlistCtaMuted: { opacity: 0.55 },

    listHost: {
      flex: 1,
      minHeight: 0,
      marginHorizontal: 16,
    },
    card: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    listScroll: { flex: 1 },
    listScrollContent: { flexGrow: 1 },
    colHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    colLabel: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    loadingRow: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 12,
    },
    rowDimmed: { opacity: 1 },
    mid: { flex: 1, gap: 4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    symbol: { color: c.text, fontSize: 15, fontWeight: '700' },
    price: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
    starBtn: { width: 28, alignItems: 'center', justifyContent: 'center' },
    right: { alignItems: 'flex-end', gap: 3 },
    value: { color: c.text, fontSize: 15, fontWeight: '700' },
    holdings: {
      color: c.textMuted,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    noHoldings: { color: c.textFaint, fontSize: 15, fontWeight: '600' },

    dividerWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
    dividerLabel: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },

    sourceNote: { color: c.textFaint, fontSize: 11, textAlign: 'center', marginTop: 16 },
    footer: { paddingBottom: 120 },
    legalFooter: { marginTop: 8, paddingHorizontal: 16 },
  });
}
