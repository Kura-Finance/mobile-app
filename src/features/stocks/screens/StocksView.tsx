/**
 * Invest → Stocks tab — Dinari stock listings.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useDinariGate, type StockItem } from '../hooks/useDinari';
import { matchesStock, normalizeSearchQuery } from '../../crypto/utils/portfolioSearch';
import StockLogo from '../components/StockLogo';
import StockDetailModal from '../modals/StockDetailModal';
import InvestListCard from '../../crypto/components/invest/InvestListCard';
import InvestSortSheet from '../../crypto/components/invest/InvestSortSheet';
import {
  INVEST_STOCK_SORT_OPTIONS,
  sortStocks,
  type InvestSortKey,
} from '../../crypto/utils/investSort';
import { applyYahooMarket, useYahooStockMarket } from '../hooks/useYahooStockMarket';
import { useFavoritesStore } from '../../crypto/store/useFavoritesStore';
import LegalDisclaimer from '../../../shared/components/LegalDisclaimer';
import LoadingDots from '../../../shared/components/LoadingDots';
import type { UseKuraCardWalletReturn } from '../../card/hooks/useKuraCardWallet';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';

import type { AssetClass } from '../../crypto/components/AssetClassToggle';

const SORT_HEADER_I18N: Record<InvestSortKey, string> = {
  price: 'crypto.sortPrice',
  marketCap: 'crypto.sortMarketCap',
  gainers: 'crypto.sortGainers',
  losers: 'crypto.sortLosers',
};

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

interface Props {
  embedded?: boolean;
  assetClass: AssetClass;
  favoritesOnly?: boolean;
  searchQuery?: string;
  scaAddress: string;
  usdcBalance: number;
  signTypedData: UseKuraCardWalletReturn['signTypedData'];
  gate: ReturnType<typeof useDinariGate>;
  stocks: StockItem[];
  stocksLoading: boolean;
  stocksRefreshing?: boolean;
  stocksError: string | null;
  onRefresh: () => void;
  onScroll?: (offsetY: number) => void;
  externalSelectedStock?: StockItem | null;
  onExternalSelectedStockHandled?: () => void;
}

function StockRow({ item, onPress }: { item: StockItem; onPress: (s: StockItem) => void }) {
  const { colors } = useTheme();
  const st = useStyles();
  const money = useMoneyFormat();
  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const hasHoldings = item.holdings > 0;
  const isFav = favorites.includes(item.symbol);
  const change24h = item.change24h;
  const hasChange = change24h != null && Number.isFinite(change24h);
  const isPositive = hasChange && change24h >= 0;

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
        {hasHoldings ? (
          <Text style={st.holdingsValue}>{money.compact(item.value)}</Text>
        ) : (
          <Text style={st.noHoldingsSub}>—</Text>
        )}
      </View>
      <View style={st.right}>
        <Text style={st.value}>
          {item.price > 0 ? money.price(item.price) : '—'}
        </Text>
        {hasChange ? (
          <Text style={[st.change, isPositive ? st.changePos : st.changeNeg]}>
            {isPositive ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
          </Text>
        ) : (
          <Text style={st.noChange}>—</Text>
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
  embedded = false,
  assetClass,
  favoritesOnly = false,
  searchQuery = '',
  scaAddress,
  usdcBalance,
  signTypedData,
  gate,
  stocks,
  stocksLoading,
  stocksRefreshing = false,
  stocksError,
  onRefresh,
  onScroll,
  externalSelectedStock,
  onExternalSelectedStockHandled,
}: Props) {
  const { t } = useTranslation();
  const st = useStyles();
  const { colors } = useTheme();
  const favorites = useFavoritesStore((s) => s.favorites);

  const [selected, setSelected] = useState<StockItem | null>(null);
  const [sortKey, setSortKey] = useState<InvestSortKey>('price');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [showDinariGate, setShowDinariGate] = useState(false);
  const pendingTradeSideRef = useRef<'buy' | 'sell' | null>(null);
  const [resumeTradeSide, setResumeTradeSide] = useState<'buy' | 'sell' | null>(null);

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

    if (
      gate.state === 'waitlist'
      || gate.state === 'kyc'
      || gate.state === 'connect'
      || gate.state === 'unsupported'
    ) {
      return false;
    }

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

  const marketBySymbol = useYahooStockMarket(stocks.map((s) => s.symbol));

  const quotedStocks = useMemo(
    () => stocks.map((item) => applyYahooMarket(item, marketBySymbol.get(item.symbol.toUpperCase()))),
    [stocks, marketBySymbol],
  );

  const sortedStocks = useMemo(
    () => sortStocks(quotedStocks, sortKey),
    [quotedStocks, sortKey],
  );

  const query = normalizeSearchQuery(searchQuery);
  const isSearching = query.length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const pool = favoritesOnly
      ? sortedStocks.filter((item) => favorites.includes(item.symbol))
      : sortedStocks;
    return pool.filter((item) => matchesStock(item, query));
  }, [favorites, favoritesOnly, isSearching, query, sortedStocks]);

  const displayedStocks = useMemo(() => {
    if (stocksLoading && stocks.length === 0) return [];
    if (isSearching) return searchResults;
    if (favoritesOnly) return sortedStocks.filter((item) => favorites.includes(item.symbol));
    return sortedStocks;
  }, [
    stocksLoading,
    stocks.length,
    isSearching,
    searchResults,
    favoritesOnly,
    favorites,
    sortedStocks,
  ]);

  const unsupportedMessage = gate.error
    ? t('crypto.dinariUnavailableBody', { error: gate.error })
    : t('crypto.dinariComingSoonBody');

  const listBody = stocksLoading && stocks.length === 0 ? (
    <View style={st.loadingRow}>
      <LoadingDots color={colors.textMuted} size={8} />
    </View>
  ) : isSearching ? (
    searchResults.length > 0 ? (
      searchResults.map((item) => (
        <StockRow key={item.id} item={item} onPress={setSelected} />
      ))
    ) : (
      <View style={st.emptyFavorites}>
        <Text style={st.emptyFavoritesText}>{t('crypto.searchNoResults')}</Text>
      </View>
    )
  ) : favoritesOnly ? (
    displayedStocks.length > 0 ? (
      displayedStocks.map((item) => (
        <StockRow key={item.id} item={item} onPress={setSelected} />
      ))
    ) : (
      <View style={st.emptyFavorites}>
        <Text style={st.emptyFavoritesText}>{t('crypto.favoritesEmpty')}</Text>
      </View>
    )
  ) : (
    displayedStocks.map((item) => (
      <StockRow key={item.id} item={item} onPress={setSelected} />
    ))
  );

  const listSection = (
    <>
      <InvestListCard
        leftLabel={t('crypto.colAsset')}
        rightLabel={t(SORT_HEADER_I18N[sortKey])}
        sortActive={sortKey !== 'price'}
        onRightPress={() => setSortSheetOpen(true)}
        refreshing={stocksRefreshing}
        onRefresh={onRefresh}
        outerScroll={embedded}
      >
        {listBody}
      </InvestListCard>
      <InvestSortSheet
        visible={sortSheetOpen}
        selected={sortKey}
        options={INVEST_STOCK_SORT_OPTIONS}
        onSelect={setSortKey}
        onClose={() => setSortSheetOpen(false)}
      />
    </>
  );

  return (
    <View style={embedded ? st.embedded : st.flex}>
      {stocksError && (
        <View style={st.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
          <Text style={st.errorText}>{stocksError}</Text>
        </View>
      )}

      {gate.state === 'unsupported' && (
        <View style={st.errorBox}>
          <Ionicons name="time-outline" size={15} color={colors.danger} />
          <Text style={st.errorText}>{unsupportedMessage}</Text>
          <TouchableOpacity onPress={() => { void gate.resolve(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={st.retryText}>{t('crypto.dinariRetry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {listSection}

      {!embedded && (
        <View style={st.footer}>
          <Text style={st.sourceNote}>{t('crypto.stocksSourceNote')}</Text>
          <LegalDisclaimer variant="securities" style={st.legalFooter} />
        </View>
      )}

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
    embedded: {},

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
    starBtn: { width: 28, alignItems: 'center', justifyContent: 'center' },
    right: { alignItems: 'flex-end', gap: 3 },
    value: { color: c.text, fontSize: 15, fontWeight: '700' },
    change: { fontSize: 11, fontWeight: '600' },
    changePos: { color: '#10B981' },
    changeNeg: { color: '#EF4444' },
    noChange: { color: c.textFaint, fontSize: 11, fontWeight: '600' },
    holdingsValue: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
    noHoldingsSub: { color: c.textFaint, fontSize: 12, fontWeight: '500' },

    sourceNote: { color: c.textFaint, fontSize: 11, textAlign: 'center', marginTop: 16 },
    footer: { paddingBottom: 120 },
    legalFooter: { marginTop: 8, paddingHorizontal: 16 },
  });
}
