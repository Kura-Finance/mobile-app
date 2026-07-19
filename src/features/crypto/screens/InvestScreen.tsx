import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { View as SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useHeaderHeight } from '../../../shared/navigation/Header';
import { useTabNavigator } from '../../../shared/navigation/TabNavigatorContext';
import { useHeaderStore } from '../../../shared/store/useHeaderStore';
import { useFavoritesStore } from '../store/useFavoritesStore';
import PortfolioToolbar from '../components/PortfolioToolbar';
import InvestMarketStrip from '../components/invest/InvestMarketStrip';
import InvestTokenPanel from '../components/invest/InvestTokenPanel';
import type { AssetClass } from '../components/AssetClassToggle';
import { isTokenAssetClass } from '../config/portfolioAssetClasses';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import { usePortfolio } from '../hooks/usePortfolio';
import type { BluechipToken } from '../config/blueChips';
import TokenDetailModal from '../modals/TokenDetailModal';
import StocksView from '../../stocks/screens/StocksView';
import EarnView from '../../earn/screens/EarnView';
import { useDinariGate, useDinariStocks } from '../../stocks/hooks/useDinari';
import SourceAndLegalFooter from '../components/SourceAndLegalFooter';
import { features } from '../../../config/features';

function useStyles() {
  const { colors } = useTheme();
  return React.useMemo(() => makeStyles(colors), [colors]);
}

export default function InvestScreen() {
  const { t } = useTranslation();
  const { activeTab } = useTabNavigator();
  const isActive = activeTab === 'Invest';
  const { colors } = useTheme();
  const st = useStyles();
  const headerHeight = useHeaderHeight();
  const setScrolled = useHeaderStore((s) => s.setScrolled);
  const favorites = useFavoritesStore((s) => s.favorites);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);

  useEffect(() => { hydrateFavorites(); }, [hydrateFavorites]);

  const {
    smartAddress,
    executeSwap,
    estimateSwapGasUsdc,
    estimateUsdcGasReserve,
    isExecutingSwap,
    isSending,
    sendToken,
    sendNativeEth,
    wrapEthToWeth,
    signMessage,
    signTypedData,
    refreshBalance,
    balances,
  } = useKuraCardWallet();

  const { tokens, isRefreshing, error, refresh } = usePortfolio(balances, { enabled: isActive });

  const stocksEnabled = features.dinariStocks && isActive;
  const earnEnabled = features.morphoEarn && isActive;

  const [assetClass, setAssetClass] = useState<AssetClass>('stablecoin');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const showStocks = stocksEnabled && assetClass === 'stock';

  const gate = useDinariGate(smartAddress, signMessage, {
    deferInitialCheck: true,
    active: showStocks,
  });
  const gateReady = gate.state === 'ready';
  const {
    stocks,
    loading: stocksLoading,
    refreshing: stocksRefreshing,
    error: stocksError,
    refresh: refreshStocks,
  } = useDinariStocks(showStocks, { includePortfolio: gateReady });

  const earnRefreshRef = useRef<(() => void) | null>(null);
  const [earnRefreshing, setEarnRefreshing] = useState(false);

  useEffect(() => {
    if (!features.dinariStocks && assetClass === 'stock') {
      setAssetClass('stablecoin');
    }
    if (!earnEnabled && assetClass === 'earn') {
      setAssetClass('stablecoin');
    }
  }, [assetClass, earnEnabled]);

  const handleAssetClassChange = (next: AssetClass) => {
    setAssetClass(next);
    setSearchQuery('');
    setScrolled(false);
  };

  const [selectedToken, setSelectedToken] = useState<BluechipToken | null>(null);

  const selectedPortfolioToken = selectedToken
    ? tokens.find((item) => item.token.symbol === selectedToken.symbol)
    : null;

  const handleRefresh = () => {
    refresh();
    void refreshBalance();
    if (showStocks) refreshStocks();
    earnRefreshRef.current?.();
  };

  const handleOuterScroll = (offsetY: number) => {
    setScrolled(offsetY > 4);
  };

  const showTokenPanel = isTokenAssetClass(assetClass);
  const showEarn = assetClass === 'earn';

  const screenRefreshing =
    (showTokenPanel && isRefreshing)
    || (showStocks && stocksRefreshing)
    || (showEarn && earnRefreshing);

  const footerSourceNote = showStocks
    ? t('crypto.footerSourceStocks')
    : showEarn
      ? t('crypto.footerSourceEarn')
      : t('crypto.footerSourcePrices');

  return (
    <SafeAreaView style={st.root}>
      <ScrollView
        style={st.outerScroll}
        contentContainerStyle={[st.outerScrollContent, { paddingTop: headerHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={Platform.OS === 'android'}
        scrollEventThrottle={16}
        onScroll={(e) => handleOuterScroll(e.nativeEvent.contentOffset.y)}
        refreshControl={
          <RefreshControl
            refreshing={screenRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <InvestMarketStrip />
        <View style={st.toolbarWrap}>
          <PortfolioToolbar
            assetClass={assetClass}
            onChangeAssetClass={handleAssetClassChange}
            stocksEnabled={stocksEnabled}
            earnEnabled={earnEnabled}
            favoritesOnly={favoritesOnly}
            onFavoritesOnlyChange={setFavoritesOnly}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
        </View>

        {error && showTokenPanel && (
          <View style={st.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
            <Text style={st.errorText}>{error}</Text>
          </View>
        )}

        {showTokenPanel && (
          <InvestTokenPanel
            assetClass={assetClass as 'stablecoin' | 'crypto'}
            tokens={tokens}
            favoritesOnly={favoritesOnly}
            searchQuery={searchQuery}
            loading={isRefreshing && tokens.length === 0}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            onPressToken={setSelectedToken}
          />
        )}

        {showStocks && (
          <StocksView
            embedded
            assetClass={assetClass}
            favoritesOnly={favoritesOnly}
            searchQuery={searchQuery}
            scaAddress={smartAddress}
            usdcBalance={balances['USDC'] ?? 0}
            signTypedData={signTypedData}
            gate={gate}
            stocks={stocks}
            stocksLoading={stocksLoading}
            stocksRefreshing={stocksRefreshing}
            stocksError={stocksError}
            onRefresh={handleRefresh}
          />
        )}

        {showEarn && (
          <EarnView
            embedded
            scaAddress={smartAddress}
            favoritesOnly={favoritesOnly}
            searchQuery={searchQuery}
            onRefresh={handleRefresh}
            onBindRefresh={(fn) => { earnRefreshRef.current = fn; }}
            onRefreshingChange={setEarnRefreshing}
          />
        )}

        <SourceAndLegalFooter sourceNote={footerSourceNote} />
      </ScrollView>

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

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    toolbarWrap: {
      paddingBottom: 4,
    },
    outerScroll: {
      flex: 1,
    },
    outerScrollContent: {
      paddingBottom: 120,
    },
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
  });
}
