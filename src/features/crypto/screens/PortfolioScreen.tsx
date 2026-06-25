import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, RefreshControl, StyleSheet,
} from 'react-native';
import { View as SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import { useFavoritesStore } from '../store/useFavoritesStore';
import PortfolioTokenRow from '../components/PortfolioTokenRow';
import { useHeaderHeight } from '../../../shared/navigation/Header';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import { useBaseBalances } from '../hooks/useBaseBalances';
import { usePortfolio } from '../hooks/usePortfolio';
import type { BluechipToken } from '../config/blueChips';
import TokenDetailModal from '../modals/TokenDetailModal';
import PortfolioStockRow from '../../stocks/components/PortfolioStockRow';
import StockDetailModal from '../../stocks/modals/StockDetailModal';
import { useDinariGate, useDinariStocks, type StockItem } from '../../stocks/hooks/useDinari';
import LoadingDots from '../../../shared/components/LoadingDots';
import LegalDisclaimer from '../../../shared/components/LegalDisclaimer';
import ConnectDappButton from '../../walletconnect/components/ConnectDappButton';
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

export default function PortfolioScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const money = useMoneyFormat();
  const headerHeight = useHeaderHeight();
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
  } = useKuraCardWallet();

  const {
    balances,
    loading: balancesLoading,
    hasLoaded: balancesLoaded,
    refresh: refreshBalances,
  } = useBaseBalances(smartAddress || null);

  const {
    tokens,
    totalValue,
    isLoading: portfolioPricesLoading,
    isRefreshing,
    error,
    refresh,
  } = usePortfolio(balances);

  const stocksEnabled = features.dinariStocks;
  const gate = useDinariGate(smartAddress, signMessage, { deferInitialCheck: false });
  const gateReady = gate.state === 'ready';
  const {
    stocks,
    totalValue: stocksTotalValue,
    loading: stocksLoading,
    refreshing: stocksRefreshing,
    error: stocksError,
    refresh: refreshStocks,
  } = useDinariStocks(stocksEnabled, { includePortfolio: gateReady, favoriteSymbols: favorites });

  const portfolioTotal = totalValue + (stocksEnabled ? stocksTotalValue : 0);

  const heldTokens = useMemo(
    () => tokens.filter((item) => item.holdings > 0),
    [tokens],
  );
  const heldStocks = useMemo(
    () => stocks.filter((item) => item.holdings > 0),
    [stocks],
  );

  const [selectedToken, setSelectedToken] = useState<BluechipToken | null>(null);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);
  const [showDinariGate, setShowDinariGate] = useState(false);
  const pendingTradeSideRef = useRef<'buy' | 'sell' | null>(null);
  const [resumeTradeSide, setResumeTradeSide] = useState<'buy' | 'sell' | null>(null);

  const selectedPortfolioToken = selectedToken
    ? tokens.find((item) => item.token.symbol === selectedToken.symbol)
    : null;

  const handleRefresh = () => {
    refresh();
    refreshBalances();
    if (stocksEnabled) refreshStocks();
  };

  const valueLoading =
    walletStatus !== 'ready' ||
    balancesLoading ||
    (!balancesLoaded && !!smartAddress);

  const portfolioLoading =
    valueLoading || portfolioPricesLoading || (stocksEnabled && stocksLoading && heldStocks.length === 0);

  const hasHoldings = heldTokens.length > 0 || heldStocks.length > 0;

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

  return (
    <SafeAreaView style={[st.root, { paddingTop: headerHeight }]}>
      <View style={st.header}>
        <View style={st.headerValueWrap}>
          <Text style={st.headerLabel}>{t('crypto.portfolio')}</Text>
          {portfolioLoading ? (
            <LoadingDots color={colors.text} size={10} />
          ) : (
            <Text style={st.headerValue}>{money.compact(portfolioTotal)}</Text>
          )}
        </View>
        {features.walletConnect ? <ConnectDappButton /> : null}
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
            {portfolioLoading && !hasHoldings ? (
              <View style={st.loadingRow}>
                <LoadingDots color={colors.textMuted} size={8} />
              </View>
            ) : !hasHoldings ? (
              <View style={st.emptyHoldings}>
                <Text style={st.emptyHoldingsText}>{t('crypto.portfolioEmpty')}</Text>
              </View>
            ) : (
              <>
                {heldTokens.length > 0 && heldStocks.length > 0 && (
                  <SectionDivider label={t('crypto.tabCrypto')} />
                )}
                {heldTokens.map((item) => (
                  <PortfolioTokenRow
                    key={item.token.symbol}
                    item={item}
                    onPress={setSelectedToken}
                    showFavorite={false}
                    dimUnheld={false}
                  />
                ))}

                {heldTokens.length > 0 && heldStocks.length > 0 && (
                  <SectionDivider label={t('crypto.tabUsStock')} />
                )}
                {heldStocks.map((item) => (
                  <PortfolioStockRow
                    key={item.id}
                    item={item}
                    onPress={setSelectedStock}
                  />
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>

      <View style={st.footer}>
        <Text style={st.sourceNote}>{t('crypto.sourceNote')}</Text>
        {stocksEnabled && heldStocks.length > 0 && (
          <Text style={st.sourceNote}>{t('crypto.stocksSourceNote')}</Text>
        )}
        <LegalDisclaimer variant="portfolio" style={st.legalFooter} />
      </View>

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
    </SafeAreaView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
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
    headerValueWrap: {
      minHeight: 44,
      justifyContent: 'flex-end',
    },
    headerValue: {
      color: c.text,
      fontSize: 36,
      fontWeight: '700',
      letterSpacing: -1,
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
    emptyHoldings: {
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 40,
    },
    emptyHoldingsText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
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
