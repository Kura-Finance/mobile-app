import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { View as SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';


import { useHeaderStore } from '../../../shared/store/useHeaderStore';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import { useFavoritesStore } from '../store/useFavoritesStore';
import AssetClassToggle from '../components/AssetClassToggle';
import { useHeaderHeight } from '../../../shared/navigation/Header';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import { useBaseBalances } from '../hooks/useBaseBalances';
import { usePortfolio, PortfolioToken } from '../hooks/usePortfolio';
import type { BluechipToken } from '../config/blueChips';
import TokenDetailModal from '../modals/TokenDetailModal';
import TokenLogo from '../components/TokenLogo';
import StocksView from '../../stocks/screens/StocksView';
import ConnectDappButton from '../../walletconnect/components/ConnectDappButton';
import LoadingDots from '../../../shared/components/LoadingDots';
import { features } from '../../../config/features';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatHoldings(n: number, symbol: string): string {
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.001) return `${n.toExponential(2)} ${symbol}`;
  if (n < 1) return `${n.toFixed(4)} ${symbol}`;
  if (n < 1000) return `${n.toFixed(2)} ${symbol}`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${symbol}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Token row
// ─────────────────────────────────────────────────────────────────────────────

interface TokenRowProps {
  item: PortfolioToken;
  onPress: (token: BluechipToken) => void;
}

function TokenRow({ item, onPress }: TokenRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const money = useMoneyFormat();
  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const { token, price, change24h, holdings, value } = item;
  const hasHoldings = holdings > 0;
  const isPositive = change24h >= 0;
  const canSwap = token.swappable;
  const isFav = favorites.includes(token.symbol);

  return (
    <TouchableOpacity
      style={[st.row, !hasHoldings && !isFav && st.rowDimmed]}
      onPress={() => onPress(token)}
      activeOpacity={0.65}
    >
      {/* Logo with optional cb badge */}
      <View style={st.logoContainer}>
        <TokenLogo token={token} size={44} />
        {token.badge && (
          <View style={[st.badge, { backgroundColor: token.color }]}>
            <Text style={st.badgeText}>{token.badge}</Text>
          </View>
        )}
      </View>

      {/* Name + price */}
      <View style={st.mid}>
        <View style={st.nameRow}>
          <Text style={st.symbol}>{token.displayName}</Text>
          {canSwap && (
            <View style={st.swapPill}>
              <Text style={st.swapPillText}>{t('crypto.trade')}</Text>
            </View>
          )}
        </View>
        <View style={st.priceRow}>
          <Text style={st.price}>{money.price(price)}</Text>
          <Text style={[st.change, isPositive ? st.changePos : st.changeNeg]}>
            {isPositive ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
          </Text>
        </View>
      </View>

      {/* Holdings */}
      <View style={st.right}>
        {hasHoldings ? (
          <>
            <Text style={st.value}>{money.compact(value)}</Text>
            <Text style={st.holdings}>{formatHoldings(holdings, token.displayName)}</Text>
          </>
        ) : (
          <Text style={st.noHoldings}>—</Text>
        )}
      </View>

      {/* Favorite toggle */}
      <TouchableOpacity
        style={st.starBtn}
        onPress={() => toggleFavorite(token.symbol)}
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

// ─────────────────────────────────────────────────────────────────────────────
// Section divider
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// CryptoScreen
// ─────────────────────────────────────────────────────────────────────────────

export default function CryptoScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const money = useMoneyFormat();
  const headerHeight = useHeaderHeight();
  const setScrolled = useHeaderStore((s) => s.setScrolled);
  const favorites = useFavoritesStore((s) => s.favorites);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);

  useEffect(() => { hydrateFavorites(); }, [hydrateFavorites]);

  const { smartAddress, status: walletStatus, executeSwap, estimateSwapGasUsdc, estimateUsdcGasReserve, isExecutingSwap, isSending, sendToken, sendNativeEth, wrapEthToWeth, signMessage, signTypedData } =
    useKuraCardWallet();

  // On-chain balances for all blue-chip tokens from SCA address
  const {
    balances,
    loading: balancesLoading,
    hasLoaded: balancesLoaded,
    refresh: refreshBalances,
  } = useBaseBalances(smartAddress || null);

  const { tokens, totalValue, isRefreshing, error, refresh } = usePortfolio(balances);

  const favoriteTokens = tokens.filter((t) => favorites.includes(t.token.symbol));
  const heldTokens = tokens.filter(
    (t) => t.holdings > 0 && !favorites.includes(t.token.symbol),
  );
  const watchTokens = tokens.filter(
    (t) => t.holdings === 0 && !favorites.includes(t.token.symbol),
  );

  // Asset class toggle: Crypto vs Stock (dShare, powered by Dinari)
  const [assetClass, setAssetClass] = useState<'crypto' | 'stock'>('crypto');

  useEffect(() => {
    if (!features.dinariStocks && assetClass === 'stock') {
      setAssetClass('crypto');
    }
  }, [assetClass]);

  // Detail modal state
  const [selectedToken, setSelectedToken] = useState<BluechipToken | null>(null);

  const selectedPortfolioToken = selectedToken
    ? tokens.find((t) => t.token.symbol === selectedToken.symbol)
    : null;

  const handleRefresh = () => {
    refresh();
    refreshBalances();
  };

  const valueLoading =
    walletStatus !== 'ready' ||
    balancesLoading ||
    (!balancesLoaded && !!smartAddress);

  return (
    <SafeAreaView style={[st.root, { paddingTop: headerHeight }]}>
        {features.dinariStocks && assetClass === 'stock' ? (
          <StocksView
            assetClass={assetClass}
            onChangeAssetClass={setAssetClass}
            scaAddress={smartAddress}
            usdcBalance={balances['USDC'] ?? 0}
            signMessage={signMessage}
            signTypedData={signTypedData}
            headerAction={<ConnectDappButton />}
          />
        ) : (
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ── Header ── */}
        <View style={st.header}>
          <View>
            <Text style={st.headerLabel}>{t('crypto.portfolio')}</Text>
            {valueLoading ? (
              <LoadingDots color={colors.text} size={10} />
            ) : (
              <Text style={st.headerValue}>{money.compact(totalValue)}</Text>
            )}
          </View>
          <ConnectDappButton />
        </View>

        {error && (
          <View style={st.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
            <Text style={st.errorText}>{error}</Text>
          </View>
        )}

        {/* ── Token list ── */}
        <View style={st.card}>
          {/* Column headers with inline Crypto/Stock toggle */}
          <View style={st.colHeader}>
            <Text style={[st.colLabel, { flex: 1 }]}>{t('crypto.colAsset')}</Text>
            <AssetClassToggle
              value={assetClass}
              onChange={setAssetClass}
              stocksEnabled={features.dinariStocks}
            />
            <Text style={[st.colLabel, { flex: 1, textAlign: 'right' }]}>{t('crypto.colHoldings')}</Text>
          </View>

          {favoriteTokens.length > 0 && (
            <>
              <SectionDivider label={t('crypto.favorites')} />
              {favoriteTokens.map((item) => (
                <TokenRow key={item.token.symbol} item={item} onPress={setSelectedToken} />
              ))}
            </>
          )}

          {heldTokens.length > 0 && (
            <>
              {favoriteTokens.length > 0 && <SectionDivider label={t('crypto.holdings')} />}
              {heldTokens.map((item) => (
                <TokenRow key={item.token.symbol} item={item} onPress={setSelectedToken} />
              ))}
            </>
          )}

          {watchTokens.length > 0 && (
            <>
              <SectionDivider label={heldTokens.length > 0 || favoriteTokens.length > 0 ? t('crypto.watchlist') : t('crypto.blueChips')} />
              {watchTokens.map((item) => (
                <TokenRow key={item.token.symbol} item={item} onPress={setSelectedToken} />
              ))}
            </>
          )}
        </View>

        <Text style={st.sourceNote}>{t('crypto.sourceNote')}</Text>
      </ScrollView>
      )}

      {/* ── Detail modal ── */}
      <TokenDetailModal
        visible={!!selectedToken}
        token={selectedToken}
        tokenPrice={selectedPortfolioToken?.price ?? 0}
        tokenChange24h={selectedPortfolioToken?.change24h ?? 0}
        usdcBalance={balances['USDC'] ?? 0}
        tokenHoldings={selectedPortfolioToken?.holdings ?? 0}
        scaAddress={smartAddress}
        onClose={() => setSelectedToken(null)}
        executeSwap={executeSwap}
        estimateSwapGasUsdc={estimateSwapGasUsdc}
        estimateGasReserve={estimateUsdcGasReserve}
        isExecutingSwap={isExecutingSwap}
        isSending={isSending}
        sendToken={sendToken}
        sendNativeEth={sendNativeEth}
        wrapEthToWeth={wrapEthToWeth}
        onTraded={handleRefresh}
        onWithdrawn={handleRefresh}
      />
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    centered: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 20,
    },
    headerLabel: {
      color: c.textMuted,
      fontSize: 13,
      marginBottom: 4,
    },
    headerValue: {
      color: c.text,
      fontSize: 36,
      fontWeight: '700',
      letterSpacing: -1,
    },

    // Error
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

    // Card container
    card: {
      marginHorizontal: 16,
      backgroundColor: c.surfaceAlt,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },

    // Column headers
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

    // Token row
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 12,
    },
    rowDimmed: {
      opacity: 1,
    },

    // Logo with badge
    logoContainer: {
      position: 'relative',
      width: 44,
      height: 44,
    },
    badge: {
      position: 'absolute',
      bottom: -2,
      right: -4,
      borderRadius: 6,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderWidth: 2,
      borderColor: c.surfaceAlt,
      minWidth: 20,
      alignItems: 'center',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 0.2,
    },

    // Name row (symbol + swap pill)
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    swapPill: {
      backgroundColor: 'rgba(139,92,246,0.12)',
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: c.primarySoft,
    },
    swapPillText: {
      color: c.primary,
      fontSize: 9,
      fontWeight: '700',
      letterSpacing: 0.3,
    },

    mid: {
      flex: 1,
      gap: 4,
    },
    symbol: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    price: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '500',
    },
    change: {
      fontSize: 11,
      fontWeight: '600',
    },
    changePos: { color: '#10B981' },
    changeNeg: { color: '#EF4444' },

    starBtn: {
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },

    right: {
      alignItems: 'flex-end',
      gap: 3,
    },
    value: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
    },
    holdings: {
      color: c.textMuted,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    noHoldings: {
      color: c.textFaint,
      fontSize: 15,
      fontWeight: '600',
    },

    // Section divider
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

    // Source
    sourceNote: {
      color: c.textFaint,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 16,
    },
  });
}
