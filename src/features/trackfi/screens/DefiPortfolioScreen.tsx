/**
 * DefiPortfolioScreen
 *
 * DeBank-style on-chain portfolio tracker for watched wallet addresses.
 * Users connect a wallet via WalletConnect (Reown AppKit); the connected
 * address is then tracked to monitor its token holdings and DeFi protocol
 * positions (lending, staking, liquidity, etc.).
 *
 * Data source: Kura backend DeBank proxy only (/api/debank/*).
 * The mobile app never calls DeBank OpenAPI directly.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { features } from '../../../config/features';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppKit, useAccount, useAppKitState } from '@reown/appkit-react-native';
import { useTranslation } from 'react-i18next';
import { useDefiScreenData } from '../hooks/useDefiScreenData';
import LoadingDots from '../../../shared/components/LoadingDots';
import DefiOnChainCard from '../components/defi/DefiOnChainCard';
import DefiAllocationCard from '../components/defi/DefiAllocationCard';
import DefiTokensSection from '../components/defi/DefiTokensSection';
import DefiProtocolsSection from '../components/defi/DefiProtocolsSection';
import DefiConnectedWalletsSection from '../components/defi/DefiConnectedWalletsSection';
import DefiAllTokensModal from '../components/defi/DefiAllTokensModal';
import TrackFiLegalFooter from '../components/TrackFiLegalFooter';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import { useFinanceStore } from '../../../shared/store/finance';
import { getCryptoSession } from '../../../lib/crypto/session';
import Logger from '../../../shared/utils/Logger';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function DefiPortfolioScreen() {
  if (!features.debank) {
    return null;
  }

  const { colors } = useTheme();
  const { t } = useTranslation();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const {
    watched,
    isInitialising,
    totalUsdValue,
    addWallet,
    removeWallet,
    loadCached,
    refresh,
    chartRange,
    setChartRange,
    tokens,
    protocols,
    allocation,
    allocationTotal,
    chartPrices,
    changeMetrics,
    totalYieldEarned,
    estApy,
    walletRows,
    anyLoading,
  } = useDefiScreenData();

  const hydrateAssetHistory = useFinanceStore((s) => s.hydrateAssetHistory);

  useEffect(() => {
    if (isInitialising) return;
    void loadCached();
    void hydrateAssetHistory(undefined, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- open-only
  }, [isInitialising]);

  const { smartAddress, status: walletStatus } = useKuraCardWallet();
  const { open } = useAppKit();
  const { address: connectedAddress, isConnected } = useAccount();
  const { isOpen: isAppKitOpen } = useAppKitState();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [awaitingConnect, setAwaitingConnect] = useState(false);
  const [isConnectingKura, setIsConnectingKura] = useState(false);
  const [tokensModalOpen, setTokensModalOpen] = useState(false);
  const wasAppKitOpenRef = useRef(false);

  const isKuraConnected = useMemo(() => {
    if (!smartAddress) return false;
    const normalised = smartAddress.toLowerCase();
    return watched.some((w) => w.address.toLowerCase() === normalised);
  }, [smartAddress, watched]);

  const handleConnect = useCallback(async () => {
    if (!getCryptoSession()) {
      Alert.alert(
        t('trackfi.defiPortfolio.connectWalletTitle'),
        t('trackfi.defiPortfolio.cryptoSessionRequired'),
      );
      return;
    }

    try {
      wasAppKitOpenRef.current = false;
      setAwaitingConnect(true);
      await open();
    } catch (err) {
      setAwaitingConnect(false);
      Logger.error('DefiPortfolio', 'Failed to open WalletConnect modal', {
        error: err instanceof Error ? err.message : String(err),
      });
      Alert.alert(
        t('trackfi.defiPortfolio.connectionFailedTitle'),
        t('trackfi.defiPortfolio.connectionFailedBody'),
      );
    }
  }, [open, t]);

  useEffect(() => {
    if (isAppKitOpen) {
      wasAppKitOpenRef.current = true;
      return;
    }

    if (!awaitingConnect || !wasAppKitOpenRef.current) return;

    wasAppKitOpenRef.current = false;
    if (!isConnected) {
      setAwaitingConnect(false);
    }
  }, [awaitingConnect, isAppKitOpen, isConnected]);

  useEffect(() => {
    if (awaitingConnect && isConnected && connectedAddress) {
      if (!getCryptoSession()) {
        setAwaitingConnect(false);
        return;
      }
      void addWallet(connectedAddress);
      setAwaitingConnect(false);
    }
  }, [awaitingConnect, isConnected, connectedAddress, addWallet]);

  const handleConnectKura = useCallback(async () => {
    if (walletStatus !== 'ready' || !smartAddress) {
      Alert.alert(
        t('trackfi.defiPortfolio.connectKuraWallet'),
        t('trackfi.defiPortfolio.walletNotReady'),
      );
      return;
    }

    if (!getCryptoSession()) {
      Alert.alert(
        t('trackfi.defiPortfolio.connectKuraWallet'),
        t('trackfi.defiPortfolio.cryptoSessionRequired'),
      );
      return;
    }

    try {
      setIsConnectingKura(true);
      await addWallet(smartAddress, t('trackfi.defiPortfolio.kuraWalletLabel'));
    } catch (err) {
      Logger.error('DefiPortfolio', 'Failed to connect Kura wallet', {
        error: err instanceof Error ? err.message : String(err),
      });
      Alert.alert(
        t('trackfi.defiPortfolio.connectKuraWallet'),
        t('trackfi.defiPortfolio.connectKuraFailed'),
      );
    } finally {
      setIsConnectingKura(false);
    }
  }, [walletStatus, smartAddress, addWallet, t]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refresh(), hydrateAssetHistory(undefined, true)]);
    setIsRefreshing(false);
  };

  const handleRemove = (address: string) => {
    Alert.alert(
      t('trackfi.defiPortfolio.removeWalletTitle'),
      t('trackfi.defiPortfolio.removeWalletMessage', { address: truncAddr(address) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('trackfi.defiPortfolio.removeWalletConfirm'),
          style: 'destructive',
          onPress: () => removeWallet(address),
        },
      ],
    );
  };

  if (isInitialising && watched.length === 0) {
    return (
      <View style={st.center}>
        <LoadingDots color={colors.primary} size={10} />
      </View>
    );
  }

  return (
    <View style={st.root}>
      <ScrollView
        style={st.container}
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <DefiOnChainCard
          totalUsdValue={totalUsdValue}
          walletCount={watched.length}
          chartPrices={chartPrices}
          chartRange={chartRange}
          onChartRangeChange={setChartRange}
          change={changeMetrics.change}
          changePercent={changeMetrics.changePercent}
          isPositive={changeMetrics.isPositive}
          hasChange={changeMetrics.hasBaseline}
          totalYieldEarned={totalYieldEarned}
          estApy={estApy}
          loading={anyLoading}
        />

        {watched.length === 0 ? (
          <View style={st.emptyState}>
            <Ionicons name="wallet-outline" size={32} color={colors.textFaint} />
            <Text style={st.emptyTitle}>{t('trackfi.defiPortfolio.emptyTitle')}</Text>
            <Text style={st.emptySub}>{t('trackfi.defiPortfolio.emptySub')}</Text>
          </View>
        ) : null}

        {watched.length > 0 ? (
          <>
            <DefiAllocationCard segments={allocation} total={allocationTotal} />
            <DefiTokensSection tokens={tokens} onViewAll={() => setTokensModalOpen(true)} />
            <DefiProtocolsSection protocols={protocols} />
          </>
        ) : null}

        <DefiConnectedWalletsSection
          wallets={walletRows}
          kuraAddress={smartAddress}
          onConnect={handleConnect}
          onConnectKura={handleConnectKura}
          isConnecting={awaitingConnect}
          isConnectingKura={isConnectingKura}
          showKuraConnect={!isKuraConnected}
          onRemove={handleRemove}
        />
        <TrackFiLegalFooter />
      </ScrollView>

      <DefiAllTokensModal
        isOpen={tokensModalOpen}
        onClose={() => setTokensModalOpen(false)}
        tokens={tokens}
      />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    container: { flex: 1 },
    content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 },
    center: {
      flex: 1,
      backgroundColor: c.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 10,
      marginBottom: 8,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    emptySub: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      paddingHorizontal: 16,
    },
  });
}
