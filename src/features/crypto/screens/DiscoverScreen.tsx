import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  StyleSheet,
} from 'react-native';
import { View as SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useHeaderHeight } from '../../../shared/navigation/Header';
import { useFavoritesStore } from '../store/useFavoritesStore';
import PortfolioToolbar from '../components/PortfolioToolbar';
import PortfolioSearchModal from '../modals/PortfolioSearchModal';
import PortfolioTokenRow from '../components/PortfolioTokenRow';
import type { AssetClass } from '../components/AssetClassToggle';
import { filterPortfolioByAssetClass, isTokenAssetClass } from '../config/portfolioAssetClasses';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import { useBaseBalances } from '../hooks/useBaseBalances';
import { usePortfolio } from '../hooks/usePortfolio';
import type { BluechipToken } from '../config/blueChips';
import TokenDetailModal from '../modals/TokenDetailModal';
import StocksView from '../../stocks/screens/StocksView';
import EarnView from '../../earn/screens/EarnView';
import { useMorphoVaults } from '../../earn/hooks/useMorphoVaults';
import { useDinariGate, useDinariStocks, type StockItem } from '../../stocks/hooks/useDinari';
import type { MorphoVault } from '../../../lib/api/morpho/client';
import LegalDisclaimer from '../../../shared/components/LegalDisclaimer';
import { features } from '../../../config/features';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
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

export default function DiscoverScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const headerHeight = useHeaderHeight();
  const favorites = useFavoritesStore((s) => s.favorites);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);

  useEffect(() => { hydrateFavorites(); }, [hydrateFavorites]);

  const { smartAddress, executeSwap, estimateSwapGasUsdc, estimateUsdcGasReserve, isExecutingSwap, isSending, sendToken, sendNativeEth, wrapEthToWeth, signMessage, signTypedData } =
    useKuraCardWallet();

  // On-chain balances for all blue-chip tokens from SCA address
  const { balances, refresh: refreshBalances } = useBaseBalances(smartAddress || null);

  const { tokens, isRefreshing, error, refresh } = usePortfolio(balances);

  const stocksEnabled = features.dinariStocks;
  const earnEnabled = features.morphoEarn;
  const gate = useDinariGate(smartAddress, signMessage, { deferInitialCheck: true });
  const gateReady = gate.state === 'ready';
  const {
    stocks,
    loading: stocksLoading,
    refreshing: stocksRefreshing,
    error: stocksError,
    refresh: refreshStocks,
  } = useDinariStocks(stocksEnabled, { includePortfolio: gateReady, favoriteSymbols: favorites });

  const { vaults: morphoVaults } = useMorphoVaults(smartAddress || null, earnEnabled);

  const [assetClass, setAssetClass] = useState<AssetClass>('stablecoin');
  const [favoritesOnly, setFavoritesOnly] = useState(false);

  useEffect(() => {
    if (!features.dinariStocks && assetClass === 'stock') {
      setAssetClass('stablecoin');
    }
    if (!earnEnabled && assetClass === 'earn') {
      setAssetClass('stablecoin');
    }
  }, [assetClass, earnEnabled]);

  const portfolioTokens = useMemo(
    () => filterPortfolioByAssetClass(tokens, assetClass),
    [tokens, assetClass],
  );

  const favoriteTokens = portfolioTokens.filter((t) => favorites.includes(t.token.symbol));
  const otherTokens = useMemo(
    () =>
      portfolioTokens
        .filter((t) => !favorites.includes(t.token.symbol))
        .sort((a, b) => Number(b.holdings > 0) - Number(a.holdings > 0)),
    [portfolioTokens, favorites],
  );

  // Detail modal state
  const [selectedToken, setSelectedToken] = useState<BluechipToken | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [stockFromSearch, setStockFromSearch] = useState<StockItem | null>(null);
  const [vaultFromSearch, setVaultFromSearch] = useState<MorphoVault | null>(null);

  const selectedPortfolioToken = selectedToken
    ? tokens.find((t) => t.token.symbol === selectedToken.symbol)
    : null;

  const handleRefresh = () => {
    refresh();
    refreshBalances();
    if (stocksEnabled) refreshStocks();
  };

  const showTokenPanel = isTokenAssetClass(assetClass);
  const showEarn = assetClass === 'earn';
  const showStocks = stocksEnabled && assetClass === 'stock';

  return (
    <SafeAreaView style={[st.root, { paddingTop: headerHeight }]}>
      <View style={st.header}>
        <View style={st.headerTitleWrap}>
          <Text style={st.headerTitle}>{t('crypto.discover')}</Text>
        </View>
      </View>

      <PortfolioToolbar
        assetClass={assetClass}
        onChangeAssetClass={setAssetClass}
        stocksEnabled={stocksEnabled}
        earnEnabled={earnEnabled}
        favoritesOnly={favoritesOnly}
        onFavoritesOnlyChange={setFavoritesOnly}
        onSearchPress={() => setSearchOpen(true)}
      />

      <View style={st.panelHost}>
        <View
          style={[st.panel, !showTokenPanel && st.panelHidden]}
          pointerEvents={showTokenPanel ? 'auto' : 'none'}
        >
          {error && (
            <View style={st.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
              <Text style={st.errorText}>{error}</Text>
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
                  <RefreshControl
                    refreshing={isRefreshing || stocksRefreshing}
                    onRefresh={handleRefresh}
                    tintColor={colors.primary}
                  />
                }
              >
                {favoritesOnly ? (
                  favoriteTokens.length > 0 ? (
                    favoriteTokens.map((item) => (
                      <PortfolioTokenRow key={item.token.symbol} item={item} onPress={setSelectedToken} />
                    ))
                  ) : (
                    <View style={st.emptyFavorites}>
                      <Text style={st.emptyFavoritesText}>{t('crypto.favoritesEmpty')}</Text>
                    </View>
                  )
                ) : (
                  <>
                    {favoriteTokens.length > 0 && (
                      <>
                        <SectionDivider label={t('crypto.favorites')} />
                        {favoriteTokens.map((item) => (
                          <PortfolioTokenRow key={item.token.symbol} item={item} onPress={setSelectedToken} />
                        ))}
                      </>
                    )}

                    {otherTokens.length > 0 && (
                      <>
                        {favoriteTokens.length > 0 && (
                          <SectionDivider label={t('crypto.watchlist')} />
                        )}
                        {otherTokens.map((item) => (
                          <PortfolioTokenRow key={item.token.symbol} item={item} onPress={setSelectedToken} />
                        ))}
                      </>
                    )}
                  </>
                )}
              </ScrollView>
            </View>
          </View>

          <View style={st.footer}>
            <Text style={st.sourceNote}>{t('crypto.sourceNote')}</Text>
            <LegalDisclaimer variant="portfolio" style={st.legalFooter} />
          </View>
        </View>

        {stocksEnabled && (
          <View
            style={[st.panel, !showStocks && st.panelHidden]}
            pointerEvents={showStocks ? 'auto' : 'none'}
          >
            <StocksView
              assetClass={assetClass}
              favoritesOnly={favoritesOnly}
              scaAddress={smartAddress}
              usdcBalance={balances['USDC'] ?? 0}
              signTypedData={signTypedData}
              gate={gate}
              stocks={stocks}
              stocksLoading={stocksLoading}
              stocksRefreshing={stocksRefreshing}
              stocksError={stocksError}
              onRefresh={handleRefresh}
              externalSelectedStock={stockFromSearch}
              onExternalSelectedStockHandled={() => setStockFromSearch(null)}
            />
          </View>
        )}

        <View
          style={[st.panel, !showEarn && st.panelHidden]}
          pointerEvents={showEarn ? 'auto' : 'none'}
        >
          <EarnView
            scaAddress={smartAddress}
            favoritesOnly={favoritesOnly}
            onRefresh={handleRefresh}
            externalSelectedVault={vaultFromSearch}
            onExternalSelectedVaultHandled={() => setVaultFromSearch(null)}
          />
        </View>
      </View>

      <PortfolioSearchModal
        visible={searchOpen}
        assetClass={assetClass}
        favoritesOnly={favoritesOnly}
        favoriteSymbols={favorites}
        tokens={tokens}
        stocks={stocks}
        vaults={morphoVaults}
        onClose={() => setSearchOpen(false)}
        onSelectToken={setSelectedToken}
        onSelectStock={(stock) => {
          setAssetClass('stock');
          setStockFromSearch(stock);
        }}
        onSelectVault={(vault) => {
          setAssetClass('earn');
          setVaultFromSearch(vault);
        }}
      />
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
    headerTitleWrap: {
      minHeight: 44,
      justifyContent: 'center',
    },
    headerTitle: {
      color: c.text,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.5,
    },

    panelHost: {
      flex: 1,
      position: 'relative',
    },
    panel: {
      ...StyleSheet.absoluteFillObject,
      flexDirection: 'column',
    },
    panelHidden: {
      display: 'none',
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

    listHost: {
      flex: 1,
      minHeight: 0,
      marginHorizontal: 16,
    },

    // Card container
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
    footer: {
      paddingBottom: 120,
    },
    legalFooter: {
      marginTop: 8,
      paddingHorizontal: 16,
    },
  });
}
