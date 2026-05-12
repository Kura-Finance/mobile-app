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
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppKit, useAccount, useAppKitState } from '@reown/appkit-react-native';
import { useTranslation } from 'react-i18next';
import {
  useDefiPortfolio,
  walletPortfolioTotal,
  walletDataKey,
  type WalletData,
  type DefiProtocol,
  type DefiToken,
} from '../hooks/useDefiPortfolio';
import { effectiveProtocolDisplayUsd } from '../../../lib/api/debank/portfolioTotals';
import LoadingDots from '../../../shared/components/LoadingDots';
import { useHideBalance } from '../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../shared/utils/privacyDisplay';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import { useAppStore } from '../../../shared/store/useAppStore';
import { getCryptoSession } from '../../../lib/crypto/session';
import Logger from '../../../shared/utils/Logger';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(value: number, hidden = false): string {
  if (hidden) return HIDDEN_BALANCE_TEXT;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function truncAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function chainLabel(chainId: string, t: (key: string, options?: { defaultValue?: string }) => string): string {
  return t(`trackfi.defiPortfolio.chains.${chainId}`, { defaultValue: chainId.toUpperCase() });
}

// ─────────────────────────────────────────────────────────────────────────────
// Token row
// ─────────────────────────────────────────────────────────────────────────────

function TokenRow({ token, hideBalance }: { token: DefiToken; hideBalance: boolean }) {
  const s = useStyles();
  const { t } = useTranslation();
  return (
    <View style={s.tokenRow}>
      <View style={s.tokenLeft}>
        {token.logoUrl ? (
          <Image source={{ uri: token.logoUrl }} style={s.tokenLogo} />
        ) : (
          <View style={[s.tokenLogo, s.tokenLogoFallback]}>
            <Text style={s.tokenLogoText}>{token.symbol.slice(0, 2)}</Text>
          </View>
        )}
        <View>
          <View style={s.tokenSymbolRow}>
            <Text style={s.tokenSymbol}>{token.symbol}</Text>
            <Text style={s.tokenChain}>{chainLabel(token.chain, t)}</Text>
          </View>
          <Text style={s.tokenAmount}>
            {token.amount < 0.001
              ? token.amount.toExponential(2)
              : token.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </Text>
        </View>
      </View>
      <Text style={s.tokenValue}>{fmt(token.usdValue, hideBalance)}</Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Protocol card
// ─────────────────────────────────────────────────────────────────────────────

function ProtocolCard({ protocol, hideBalance }: { protocol: DefiProtocol; hideBalance: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={s.protocolCard}
      onPress={() => setExpanded((v) => !v)}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={s.protocolHeader}>
        <View style={s.protocolLeft}>
          {protocol.logoUrl ? (
            <Image source={{ uri: protocol.logoUrl }} style={s.protocolLogo} />
          ) : (
            <View style={[s.protocolLogo, s.protocolLogoFallback]}>
              <Text style={s.protocolLogoText}>{protocol.name.slice(0, 2)}</Text>
            </View>
          )}
          <View>
            <Text style={s.protocolName}>{protocol.name}</Text>
            <Text style={s.protocolChain}>{chainLabel(protocol.chain, t)}</Text>
          </View>
        </View>
        <View style={s.protocolRight}>
          <Text style={s.protocolValue}>{fmt(effectiveProtocolDisplayUsd(protocol), hideBalance)}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textFaint}
          />
        </View>
      </View>

      {/* Debt badge */}
      {protocol.debtUsdValue > 0 && (
        <View style={s.debtBadge}>
          <Text style={s.debtBadgeText}>
            {t('trackfi.defiPortfolio.debt', { amount: fmt(protocol.debtUsdValue, hideBalance) })}
          </Text>
        </View>
      )}

      {/* Expanded positions */}
      {expanded && protocol.portfolioItems.map((item, i) => (
        <View key={i} style={s.positionSection}>
          <Text style={s.positionType}>{item.type}</Text>
          {item.tokens.map((t, j) => (
            <View key={j} style={s.positionToken}>
              {t.logoUrl ? (
                <Image source={{ uri: t.logoUrl }} style={s.posTokenLogo} />
              ) : (
                <View style={[s.posTokenLogo, s.tokenLogoFallback]}>
                  <Text style={s.tokenLogoText}>{t.symbol.slice(0, 2)}</Text>
                </View>
              )}
              <Text style={s.posTokenSymbol}>{t.symbol}</Text>
              <Text style={s.posTokenAmount}>
                {t.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </Text>
              <Text style={s.posTokenValue}>{fmt(t.usdValue, hideBalance)}</Text>
            </View>
          ))}
        </View>
      ))}
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Single wallet section
// ─────────────────────────────────────────────────────────────────────────────

function WalletSection({
  data,
  onRemove,
  hideBalance,
}: {
  data: WalletData;
  onRemove: () => void;
  hideBalance: boolean;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [showTokens, setShowTokens] = useState(false);
  const topTokens = data.tokens.slice(0, showTokens ? undefined : 5);
  const hasMore = data.tokens.length > 5 && !showTokens;

  return (
    <View style={s.walletSection}>
      {/* Wallet header */}
      <View style={s.walletHeader}>
        <View style={s.walletAddressRow}>
          <View style={s.walletDot} />
          <View>
            {data.label ? (
              <Text style={s.walletLabel}>{data.label}</Text>
            ) : null}
            <Text style={s.walletAddr}>{truncAddr(data.address)}</Text>
          </View>
        </View>
        <View style={s.walletHeaderRight}>
          {data.isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={s.walletTotal}>{fmt(walletPortfolioTotal(data), hideBalance)}</Text>
          )}
          <TouchableOpacity onPress={onRemove} style={s.removeBtn} hitSlop={8}>
            <Ionicons name="close-circle-outline" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        </View>
      </View>

      {data.error ? (
        <View style={s.errorBox}>
          <Ionicons name="warning-outline" size={14} color={colors.danger} />
          <Text style={s.errorText}>{data.error}</Text>
        </View>
      ) : data.isLoading ? (
        <View style={s.loadingRow}>
          <Text style={s.loadingText}>{t('trackfi.defiPortfolio.loadingPortfolio')}</Text>
        </View>
      ) : (
        <>
          {/* Token holdings */}
          {data.tokens.length > 0 && (
            <View style={s.subsection}>
              <Text style={s.subsectionTitle}>{t('trackfi.defiPortfolio.tokensSection')}</Text>
              {topTokens.map((t) => (
                <TokenRow key={`${t.chain}-${t.id}`} token={t} hideBalance={hideBalance} />
              ))}
              {hasMore && (
                <TouchableOpacity
                  style={s.showMoreBtn}
                  onPress={() => setShowTokens(true)}
                >
                  <Text style={s.showMoreText}>
                    {t('trackfi.defiPortfolio.showMoreTokens', { count: data.tokens.length - 5 })}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* DeFi protocol positions */}
          {data.protocols.length > 0 && (
            <View style={s.subsection}>
              <Text style={s.subsectionTitle}>{t('trackfi.defiPortfolio.protocolsSection')}</Text>
              {data.protocols.map((p) => (
                <ProtocolCard key={`${p.chain}-${p.id}`} protocol={p} hideBalance={hideBalance} />
              ))}
            </View>
          )}

          {data.tokens.length === 0 && data.protocols.length === 0 && (
            <View style={s.emptyWallet}>
              <Text style={s.emptyWalletText}>{t('trackfi.defiPortfolio.noHoldings')}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Connect wallet row
// ─────────────────────────────────────────────────────────────────────────────

function ConnectWalletSection({
  onConnect,
  isConnecting,
  onConnectKura,
  isConnectingKura,
  showKuraConnect,
}: {
  onConnect: () => void;
  isConnecting: boolean;
  onConnectKura: () => void;
  isConnectingKura: boolean;
  showKuraConnect: boolean;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={s.addSection}>
      <TouchableOpacity
        style={s.addBtn}
        onPress={onConnect}
        activeOpacity={0.8}
        disabled={isConnecting || isConnectingKura}
      >
        {isConnecting ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="wallet-outline" size={18} color={colors.primary} />
        )}
        <Text style={s.addBtnText}>
          {isConnecting ? t('trackfi.defiPortfolio.connecting') : t('trackfi.defiPortfolio.connectWalletConnect')}
        </Text>
      </TouchableOpacity>

      {showKuraConnect && (
        <TouchableOpacity
          style={[s.addBtn, s.addBtnSecondary]}
          onPress={onConnectKura}
          activeOpacity={0.8}
          disabled={isConnecting || isConnectingKura}
        >
          {isConnectingKura ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
          )}
          <Text style={s.addBtnText}>
            {isConnectingKura
              ? t('trackfi.defiPortfolio.connectingKura')
              : t('trackfi.defiPortfolio.connectKuraWallet')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────

export default function DefiPortfolioScreen() {
  if (!features.debank) {
    return null;
  }

  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const {
    watched,
    walletData,
    isInitialising,
    totalUsdValue,
    anyRateLimited,
    addWallet,
    removeWallet,
    loadCached,
    refresh,
  } = useDefiPortfolio();

  // Load backend cache on open — does not trigger a DeBank sync.
  useEffect(() => {
    if (isInitialising) return;
    void loadCached();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: open-only, not on watched changes
  }, [isInitialising]);

  const { smartAddress, status: walletStatus } = useKuraCardWallet();
  const hideBalance = useHideBalance();

  const { open } = useAppKit();
  const { address: connectedAddress, isConnected } = useAccount();
  const { isOpen: isAppKitOpen } = useAppKitState();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [awaitingConnect, setAwaitingConnect] = useState(false);
  const [isConnectingKura, setIsConnectingKura] = useState(false);
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

  // open() does not wait for the modal to close — reset spinner if user dismisses without connecting.
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

  // Once the user has connected a wallet, add its address to the watch list.
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

  const anyWalletLoading = watched.some(
    (w) => walletData[walletDataKey(w.address)]?.isLoading,
  );
  const showTotalLoading = isInitialising || (anyWalletLoading && totalUsdValue === 0);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
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
      <View style={s.center}>
        <LoadingDots color={colors.primary} size={10} />
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      {/* Summary header */}
      <View style={s.summaryHeader}>
        <View>
          <Text style={s.summaryEyebrow}>{t('trackfi.defiPortfolio.onChainPortfolio')}</Text>
          {showTotalLoading ? (
            <LoadingDots color={colors.text} size={10} />
          ) : (
            <Text style={s.summaryTotal}>{fmt(totalUsdValue, hideBalance)}</Text>
          )}
        </View>
        <View style={s.walletCountBadge}>
          <Text style={s.walletCountText}>
            {t('trackfi.defiPortfolio.walletCount', { count: watched.length })}
          </Text>
        </View>
      </View>

      {anyRateLimited && (
        <View style={s.rateLimitNotice}>
          <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
          <Text style={s.rateLimitNoticeText}>
            {t('trackfi.defiPortfolio.rateLimited')}
          </Text>
        </View>
      )}

      {/* Empty state */}
      {watched.length === 0 && (
        <View style={s.emptyState}>
          <Text style={s.emptyIcon}>🔍</Text>
          <Text style={s.emptyTitle}>{t('trackfi.defiPortfolio.emptyTitle')}</Text>
          <Text style={s.emptySub}>{t('trackfi.defiPortfolio.emptySub')}</Text>
        </View>
      )}

      {/* Wallet sections */}
      {watched.map((w) => {
        const data = walletData[walletDataKey(w.address)];
        if (!data) return null;
        return (
          <WalletSection
            key={w.address}
            data={data}
            hideBalance={hideBalance}
            onRemove={() => handleRemove(w.address)}
          />
        );
      })}

      {/* Connect wallet */}
      <ConnectWalletSection
        onConnect={handleConnect}
        isConnecting={awaitingConnect}
        onConnectKura={handleConnectKura}
        isConnectingKura={isConnectingKura}
        showKuraConnect={!isKuraConnected}
      />

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  content: { paddingHorizontal: 16, paddingTop: 16 },
  center: { flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' },

  // Summary
  summaryHeader: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginBottom: 20, paddingHorizontal: 4,
  },
  summaryEyebrow: {
    color: c.textMuted, fontSize: 13, marginBottom: 4,
  },
  summaryTotal: { color: c.text, fontSize: 36, fontWeight: '700', letterSpacing: -1 },
  walletCountBadge: {
    backgroundColor: c.primarySoft, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: c.primarySoft,
  },
  walletCountText: { color: c.primary, fontSize: 12, fontWeight: '600' },

  rateLimitNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: c.surfaceAlt,
    borderWidth: 1,
    borderColor: c.border,
    marginBottom: 16,
  },
  rateLimitNoticeText: {
    flex: 1,
    color: c.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { color: c.text, fontSize: 18, fontWeight: '700' },
  emptySub: { color: c.textFaint, fontSize: 13, lineHeight: 19, textAlign: 'center', paddingHorizontal: 24 },

  // Wallet section
  walletSection: {
    backgroundColor: c.surfaceAlt, borderRadius: 20,
    marginBottom: 16, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
  },
  walletHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border,
  },
  walletAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  walletDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary },
  walletLabel: { color: c.text, fontSize: 13, fontWeight: '600' },
  walletAddr: { color: c.textMuted, fontSize: 12, fontFamily: 'monospace' },
  walletHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  walletTotal: { color: c.text, fontSize: 15, fontWeight: '700' },
  removeBtn: { padding: 2 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginVertical: 12,
    backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10,
    padding: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  errorText: { color: '#FCA5A5', fontSize: 12, flex: 1 },

  loadingRow: { padding: 24, alignItems: 'center' },
  loadingText: { color: c.textFaint, fontSize: 13 },

  emptyWallet: { padding: 20, alignItems: 'center' },
  emptyWalletText: { color: c.textFaint, fontSize: 13 },

  // Subsections
  subsection: { paddingTop: 12, paddingBottom: 8 },
  subsectionTitle: {
    color: c.textFaint, fontSize: 10, fontWeight: '700', letterSpacing: 1.2,
    paddingHorizontal: 16, marginBottom: 8,
  },

  // Token row
  tokenRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 9,
  },
  tokenLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  tokenLogo: { width: 32, height: 32, borderRadius: 16 },
  tokenLogoFallback: { backgroundColor: c.surfaceInput, justifyContent: 'center', alignItems: 'center' },
  tokenLogoText: { color: c.textMuted, fontSize: 10, fontWeight: '700' },
  tokenSymbolRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tokenSymbol: { color: c.text, fontSize: 13, fontWeight: '600' },
  tokenChain: {
    color: c.textFaint, fontSize: 10, fontWeight: '600',
    backgroundColor: c.surfaceInput, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  tokenAmount: { color: c.textFaint, fontSize: 11, marginTop: 2 },
  tokenValue: { color: c.textMuted, fontSize: 13, fontWeight: '600' },

  showMoreBtn: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center' },
  showMoreText: { color: c.primary, fontSize: 12, fontWeight: '600' },

  // Protocol card
  protocolCard: {
    marginHorizontal: 12, marginBottom: 8, backgroundColor: c.surface,
    borderRadius: 14, padding: 12,
    borderWidth: StyleSheet.hairlineWidth, borderColor: c.border,
  },
  protocolHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  protocolLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  protocolLogo: { width: 28, height: 28, borderRadius: 8 },
  protocolLogoFallback: { backgroundColor: c.surfaceInput, justifyContent: 'center', alignItems: 'center' },
  protocolLogoText: { color: c.textMuted, fontSize: 9, fontWeight: '700' },
  protocolName: { color: c.text, fontSize: 13, fontWeight: '600' },
  protocolChain: { color: c.textFaint, fontSize: 11 },
  protocolRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  protocolValue: { color: c.text, fontSize: 14, fontWeight: '700' },

  debtBadge: {
    alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)',
  },
  debtBadgeText: { color: c.danger, fontSize: 11, fontWeight: '600' },

  positionSection: {
    marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border, paddingTop: 8,
  },
  positionType: {
    color: c.textFaint, fontSize: 10, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
  },
  positionToken: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  posTokenLogo: { width: 20, height: 20, borderRadius: 10 },
  posTokenSymbol: { color: c.textMuted, fontSize: 12, fontWeight: '500', flex: 1 },
  posTokenAmount: { color: c.textMuted, fontSize: 12 },
  posTokenValue: { color: c.text, fontSize: 12, fontWeight: '600', minWidth: 60, textAlign: 'right' },

  // Add wallet
  addSection: { marginBottom: 8 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: c.primarySoft, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: c.primary,
    borderStyle: 'dashed',
  },
  addBtnSecondary: { marginTop: 10 },
  addBtnText: { color: c.primary, fontSize: 14, fontWeight: '600' },
  });
}
