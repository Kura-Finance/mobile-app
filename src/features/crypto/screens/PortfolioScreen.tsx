import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { View as SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../shared/hooks/useHideBalance';
import { useFavoritesStore } from '../store/useFavoritesStore';
import { useHeaderHeight } from '../../../shared/navigation/Header';
import { useTabNavigator } from '../../../shared/navigation/TabNavigatorContext';
import { useHeaderStore } from '../../../shared/store/useHeaderStore';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { HIDDEN_BALANCE_TEXT } from '../../../shared/utils/privacyDisplay';
import { formatSignedPct, computePortfolioPnL } from '../utils/portfolioPnL';
import { groupPortfolioTokens, sumEarnDeposits } from '../config/portfolioAssetClasses';
import PortfolioAllocation from '../components/portfolio/PortfolioAllocation';
import PortfolioAssetGroup from '../components/portfolio/PortfolioAssetGroup';
import { computePortfolioAllocation } from '../utils/portfolioAllocation';
import type { PortfolioDisplayGroup } from '../config/portfolioAssetClasses';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import { usePortfolio } from '../hooks/usePortfolio';
import type { BluechipToken } from '../config/blueChips';
import TokenDetailModal from '../modals/TokenDetailModal';
import StockDetailModal from '../../stocks/modals/StockDetailModal';
import EarnDetailModal from '../../earn/modals/EarnDetailModal';
import { useMorphoVaults } from '../../earn/hooks/useMorphoVaults';
import type { MorphoVault } from '../../../lib/api/morpho/client';
import { useDinariGate, useDinariStocks, type StockItem } from '../../stocks/hooks/useDinari';
import LoadingDots from '../../../shared/components/LoadingDots';
import SourceAndLegalFooter from '../components/SourceAndLegalFooter';
import PortfolioBorrowGroup from '../components/portfolio/PortfolioBorrowGroup';
import { useMorphoBorrow } from '../../borrow/hooks/useMorphoBorrow';
import ConnectDappButton from '../../walletconnect/components/ConnectDappButton';
import { features } from '../../../config/features';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

export default function PortfolioScreen() {
  const { t } = useTranslation();
  const { activeTab } = useTabNavigator();
  const isActive = activeTab === 'Portfolio';
  const { colors } = useTheme();
  const st = useStyles();
  const money = useMoneyFormat();
  const headerHeight = useHeaderHeight();
  const setScrolled = useHeaderStore((s) => s.setScrolled);
  const hideBalance = useHideBalance();
  const setHideBalance = useAppStore((s) => s.setHideBalance);
  const favorites = useFavoritesStore((s) => s.favorites);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);

  useEffect(() => { hydrateFavorites(); }, [hydrateFavorites]);

  const {
    smartAddress,
    status: walletStatus,
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
    balancesLoading,
    balancesHasLoaded,
  } = useKuraCardWallet();

  const {
    tokens,
    totalValue,
    isLoading: portfolioPricesLoading,
    isRefreshing,
    error,
    refresh,
  } = usePortfolio(balances, { enabled: isActive });

  const earnEnabled = features.morphoEarn && isActive;
  const borrowEnabled = features.morphoEarn && isActive;
  const {
    vaults: earnVaults,
    positionsByVault,
    loading: earnLoading,
    refreshing: earnRefreshing,
    refresh: refreshEarn,
  } = useMorphoVaults(smartAddress || null, earnEnabled);

  const {
    markets: borrowMarkets,
    positions: borrowPositions,
    positionsByMarket,
    totalBorrowedUsd,
    loading: borrowLoading,
    refreshing: borrowRefreshing,
    refresh: refreshBorrow,
  } = useMorphoBorrow(smartAddress || null, borrowEnabled);

  const stocksEnabled = features.dinariStocks && isActive;
  const gate = useDinariGate(smartAddress, signMessage, {
    deferInitialCheck: true,
    active: stocksEnabled,
  });
  const gateReady = gate.state === 'ready';
  const {
    stocks,
    totalValue: stocksTotalValue,
    loading: stocksLoading,
    refreshing: stocksRefreshing,
    error: stocksError,
    refresh: refreshStocks,
  } = useDinariStocks(stocksEnabled, { includePortfolio: gateReady });

  const earnTotalValue = useMemo(
    () => sumEarnDeposits(earnVaults, positionsByVault),
    [earnVaults, positionsByVault],
  );

  const portfolioTotal = totalValue
    + (stocksEnabled ? stocksTotalValue : 0)
    + (earnEnabled ? earnTotalValue : 0);

  const pnl = useMemo(() => computePortfolioPnL(tokens, stocks), [tokens, stocks]);
  const tokenGroups = useMemo(() => groupPortfolioTokens(tokens), [tokens]);

  const allocationTotals = useMemo((): Record<PortfolioDisplayGroup, number> => ({
    cash: tokenGroups.cash.reduce((sum, item) => sum + item.value, 0),
    crypto: tokenGroups.crypto.reduce((sum, item) => sum + item.value, 0),
    earn: earnTotalValue,
    stocks: stocksTotalValue,
  }), [tokenGroups, earnTotalValue, stocksTotalValue]);

  const allocationSlices = useMemo(
    () => computePortfolioAllocation(allocationTotals, portfolioTotal, {
      includeStocks: stocksEnabled,
    }),
    [allocationTotals, portfolioTotal, stocksEnabled],
  );

  const scrollRef = useRef<ScrollView>(null);
  const assetsSectionY = useRef(0);

  const scrollToAssets = useCallback(() => {
    scrollRef.current?.scrollTo({ y: Math.max(assetsSectionY.current - 8, 0), animated: true });
  }, []);

  const [hideSmallBalances, setHideSmallBalances] = useState(false);
  const [selectedToken, setSelectedToken] = useState<BluechipToken | null>(null);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [selectedVault, setSelectedVault] = useState<MorphoVault | null>(null);
  const [showDinariGate, setShowDinariGate] = useState(false);
  const pendingTradeSideRef = useRef<'buy' | 'sell' | null>(null);
  const [resumeTradeSide, setResumeTradeSide] = useState<'buy' | 'sell' | null>(null);

  const selectedPortfolioToken = selectedToken
    ? tokens.find((item) => item.token.symbol === selectedToken.symbol)
    : null;

  const handleRefresh = () => {
    refresh();
    void refreshBalance();
    if (stocksEnabled) refreshStocks();
    if (earnEnabled) refreshEarn();
    if (borrowEnabled) refreshBorrow();
  };

  const valueLoading =
    walletStatus !== 'ready' ||
    balancesLoading ||
    (!balancesHasLoaded && !!smartAddress);

  const portfolioLoading =
    valueLoading
    || portfolioPricesLoading
    || (stocksEnabled && stocksLoading)
    || (earnEnabled && earnLoading)
    || (borrowEnabled && borrowLoading);

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

  const isPositive = pnl.todayChangeUsd >= 0;
  const changeColor = isPositive ? '#10B981' : '#EF4444';

  return (
    <SafeAreaView style={st.root}>
      <ScrollView
        ref={scrollRef}
        style={st.scroll}
        contentContainerStyle={[st.scrollContent, { paddingTop: headerHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing || stocksRefreshing || earnRefreshing || borrowRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={st.balanceSection}>
          <View style={st.balanceLabelRow}>
            <Text style={st.balanceLabel}>{t('accounts.totalBalance')}</Text>
            <TouchableOpacity
              onPress={() => setHideBalance(!hideBalance)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={t('settings.hideBalance')}
            >
              <Ionicons
                name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
                size={16}
                color={colors.textFaint}
              />
            </TouchableOpacity>
          </View>

          <View style={st.balanceMainRow}>
            <View style={st.balanceValueWrap}>
              {portfolioLoading ? (
                <LoadingDots color={colors.text} size={10} />
              ) : (
                <Text style={st.balanceValue}>
                  {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(portfolioTotal)}
                </Text>
              )}
              {!portfolioLoading && !hideBalance && portfolioTotal > 0 && (
                <Text style={[st.todayChange, { color: changeColor }]}>
                  {t('crypto.todayChange', {
                    amount: money.signedCompact(pnl.todayChangeUsd),
                    pct: formatSignedPct(pnl.todayChangePct),
                  })}
                </Text>
              )}
            </View>
            {features.walletConnect ? (
              <View style={st.balanceAction}>
                <ConnectDappButton />
              </View>
            ) : null}
          </View>
        </View>

        {!portfolioLoading && portfolioTotal > 0 && (
          <PortfolioAllocation
            slices={allocationSlices}
            onSeeDetails={scrollToAssets}
          />
        )}

        <View
          style={st.assetsHeader}
          onLayout={(e) => { assetsSectionY.current = e.nativeEvent.layout.y; }}
        >
          <Text style={st.assetsTitle}>{t('crypto.portfolioAssets')}</Text>
          <View style={st.hideSmallRow}>
            <Text style={st.hideSmallLabel}>{t('crypto.hideSmallBalances')}</Text>
            <Switch
              value={hideSmallBalances}
              onValueChange={setHideSmallBalances}
              trackColor={{ false: colors.border, true: colors.primarySoft }}
              thumbColor={hideSmallBalances ? colors.primary : colors.textFaint}
            />
          </View>
        </View>

        {error && (
          <View style={st.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
            <Text style={st.errorText}>{error}</Text>
          </View>
        )}

        {stocksError && (
          <View style={st.errorBox}>
            <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
            <Text style={st.errorText}>{stocksError}</Text>
          </View>
        )}

        {portfolioLoading ? (
          <View style={st.loadingRow}>
            <LoadingDots color={colors.textMuted} size={8} />
          </View>
        ) : (
          <>
            {allocationSlices.map((slice) => {
              const common = {
                group: slice.key,
                portfolioTotal,
                hideSmallBalances,
                onPressToken: setSelectedToken,
              };

              switch (slice.key) {
                case 'cash':
                  return (
                    <PortfolioAssetGroup
                      key={slice.key}
                      {...common}
                      tokens={tokenGroups.cash}
                    />
                  );
                case 'crypto':
                  return (
                    <PortfolioAssetGroup
                      key={slice.key}
                      {...common}
                      tokens={tokenGroups.crypto}
                    />
                  );
                case 'earn':
                  if (!earnEnabled) return null;
                  return (
                    <PortfolioAssetGroup
                      key={slice.key}
                      {...common}
                      vaults={earnVaults}
                      positionsByVault={positionsByVault}
                      onPressVault={setSelectedVault}
                    />
                  );
                case 'stocks':
                  if (!stocksEnabled) return null;
                  return (
                    <PortfolioAssetGroup
                      key={slice.key}
                      {...common}
                      stocks={stocks}
                      onPressStock={setSelectedStock}
                    />
                  );
                default:
                  return null;
              }
            })}
            {borrowEnabled && totalBorrowedUsd > 0 && (
              <PortfolioBorrowGroup
                scaAddress={smartAddress || null}
                markets={borrowMarkets}
                positions={borrowPositions}
                positionsByMarket={positionsByMarket}
                totalBorrowedUsd={totalBorrowedUsd}
                loading={borrowLoading}
                onRefresh={refreshBorrow}
              />
            )}
            {portfolioTotal <= 0 && (
              <View style={st.emptyHoldings}>
                <Text style={st.emptyHoldingsText}>{t('crypto.portfolioEmpty')}</Text>
              </View>
            )}
          </>
        )}

        <SourceAndLegalFooter
          stocksEnabled={stocksEnabled}
          earnEnabled={earnEnabled}
          borrowEnabled={borrowEnabled}
        />
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

      <StockDetailModal
        visible={!!selectedStock}
        stock={selectedStock}
        usdcBalance={balances['USDC'] ?? 0}
        scaAddress={smartAddress}
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
        onClose={() => setSelectedStock(null)}
        onTraded={handleRefresh}
      />

      <EarnDetailModal
        visible={!!selectedVault}
        vault={selectedVault}
        scaAddress={smartAddress}
        depositedUsd={selectedVault
          ? (positionsByVault[selectedVault.address.toLowerCase()]?.assetsUsd ?? 0)
          : 0}
        onClose={() => setSelectedVault(null)}
        onPositionChanged={handleRefresh}
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
    scroll: { flex: 1 },
    scrollContent: {
      paddingBottom: 120,
    },
    balanceSection: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    balanceLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    balanceLabel: {
      color: c.textFaint,
      fontSize: 13,
      fontWeight: '500',
    },
    balanceMainRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    balanceValueWrap: {
      flex: 1,
      minHeight: 52,
      justifyContent: 'center',
    },
    balanceValue: {
      color: c.text,
      fontSize: 36,
      fontWeight: '700',
      letterSpacing: -1,
    },
    todayChange: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
    },
    balanceAction: {
      marginTop: 4,
    },
    assetsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 12,
      gap: 12,
    },
    assetsTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
    },
    hideSmallRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
    },
    hideSmallLabel: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '500',
      flexShrink: 1,
      textAlign: 'right',
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
    loadingRow: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 32,
    },
    emptyHoldings: {
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 32,
    },
    emptyHoldingsText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
  });
}
