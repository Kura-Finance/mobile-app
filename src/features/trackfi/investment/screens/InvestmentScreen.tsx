import React, { useMemo, useState, useEffect } from 'react';
import { View, ScrollView, Text, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { InvestmentCategory } from '../../../../shared/navigation/TabNavigator';
import { useTranslation } from 'react-i18next';
import { useFinanceStore } from '../../../../shared/store/useFinanceStore';
import { useExchangeStore } from '../../../../shared/store/useExchangeStore';
import { useAppStore } from '../../../../shared/store/useAppStore';
import PerformanceSummary from '../components/PerformanceSummary';
import WaveChart from '../components/WaveChart';
import AccountCapsules from '../components/AccountCapsules';
import HoldingsList from '../components/HoldingsList';
import ConnectAccountModal from '../../../../shared/components/ConnectAccountModal';
import PlaidLinkModal from '../../../../shared/components/PlaidLinkModal';
import ExchangeLinkModal from '../../../../shared/components/ExchangeLinkModal';
import { useInitializePlaidData } from '../../../../shared/hooks/useInitializePlaidData';
import { useRefreshInvestmentData } from '../hooks/useRefreshInvestmentData';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import { getAssetHistoryDaysLimit } from '../../../../shared/utils/membership';

interface InvestmentScreenProps {
  category?: InvestmentCategory;
  /**
   * Incremented every time the TrackFi passkey session transitions to
   * `unlocked`. Used to trigger a fresh exchange-balance fetch after the
   * crypto session becomes available.
   */
  unlockSeq?: number;
}

/**
 * Category filter for InvestmentScreen:
 *
 *   Stock = broker-held assets via Plaid (stocks, ETFs, and crypto held in a
 *           brokerage account) PLUS connected exchange (CEX) spot balances, so
 *           brokers and exchanges are shown together on the Broker page.
 *
 *   Note: TabNav "Crypto" (exchange spot + DeBank tokens) and "DeFi" (DeBank protocols)
 *   are handled by their own Coming-Soon screens; InvestmentScreen is only used for "Stock".
 */
function categoryFilter(type: string, category: InvestmentCategory | undefined): boolean {
  if (!category || category === 'Transaction') return true;
  switch (category) {
    // Stock tab: all Plaid broker-held assets including crypto-in-brokerage
    case 'Stock':  return type === 'stock' || type === 'etf' || type === 'crypto';
    // These cases are kept for completeness but currently rendered by ComingSoonScreen
    case 'Crypto': return type === 'crypto';
    case 'DeFi':   return type === 'other';
    default:       return true;
  }
}

export default function InvestmentScreen({ category, unlockSeq: _unlockSeq = 0 }: InvestmentScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // State Management - UI control
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showPlaidModal, setShowPlaidModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);

  // Data Management - Finance (Plaid/Broker/Web3)
  const financeInvestmentAccounts = useFinanceStore((state) => state.investmentAccounts);
  const financeInvestments = useFinanceStore((state) => state.investments);
  const selectedTimeRange = useFinanceStore((state) => state.selectedTimeRange);
  const setSelectedTimeRange = useFinanceStore((state) => state.setSelectedTimeRange);
  const membershipLabel = useAppStore((state) => state.userProfile.membershipLabel);
  const historyDaysLimit = useMemo(
    () => getAssetHistoryDaysLimit(membershipLabel),
    [membershipLabel],
  );

  // Data Management - Exchange (交易所)
  const exchangeAccounts = useExchangeStore((state) => state.exchangeAccounts);
  const exchangeInvestments = useExchangeStore((state) => state.exchangeInvestments);
  const exchangeIsLoading = useExchangeStore((state) => state.isLoading);
  const exchangeError = useExchangeStore((state) => state.error);
  const exchangeRateLimitInfo = useExchangeStore((state) => state.rateLimitInfo);

  // App Store - auth info
  const plaidLinkToken = useAppStore((state: any) => state.plaidLinkToken);

  // Data Refresh - custom hooks handling all logic
  useInitializePlaidData(); // Load Plaid data on first mount
  const { refreshing, handleRefresh } = useRefreshInvestmentData(); // Pull-to-refresh for both Plaid + Exchange

  // True while any exchange account is fetching balances.
  const anyExchangeLoading = Object.values(exchangeIsLoading).some(Boolean);

  // True when any connected account hit its daily sync limit (cached data shown).
  const anyRateLimited = Object.values(exchangeRateLimitInfo).some(
    (info) => info?.limitReached,
  );

  // Classify the exchange error into an actionable, localized message.
  //   - missing crypto session → user must unlock with passkey
  //   - everything else        → generic sync failure (retry via pull-to-refresh)
  const exchangeNotice = useMemo(() => {
    if (exchangeError) {
      if (/crypto session/i.test(exchangeError)) {
        return { kind: 'locked' as const, text: t('investments.exchangeLocked') };
      }
      return { kind: 'error' as const, text: t('investments.exchangeSyncFailed') };
    }
    if (anyRateLimited) {
      return { kind: 'info' as const, text: t('investments.exchangeRateLimited') };
    }
    return null;
  }, [exchangeError, anyRateLimited, t]);

  // Combine data from all sources - Plaid + Exchange accounts.
  // Exchange accounts are shown even before their balances are fetched (the
  // capsule appears immediately after hydrateExchangeAccounts; holdings load
  // in the background and show a skeleton until ready).
  const investmentAccounts = useMemo(() => {
    const plaidAccounts = financeInvestmentAccounts.map((acc) => ({
      ...acc,
      type: (acc.type || 'Broker') as 'Broker' | 'Exchange' | 'Web3 Wallet',
    }));
    // Build exchange capsule accounts from the lightweight account list so
    // they appear even when balances haven't been fetched yet.
    const exchangeAccountsFromStore = exchangeAccounts.map((acc) => ({
      id: acc.id,
      name: acc.exchangeDisplayName,
      logo: acc.icon,
      type: 'Exchange' as const,
    }));
    return [...plaidAccounts, ...exchangeAccountsFromStore];
  }, [financeInvestmentAccounts, exchangeAccounts]);

  // Combine investments from both sources (Plaid brokers + exchange spot) and
  // filter by category. The Broker (Stock) page shows brokers and exchanges
  // together.
  const investments = useMemo(() => {
    const sources = [...financeInvestments, ...exchangeInvestments];
    return sources.filter((inv) => categoryFilter(inv.type, category));
  }, [financeInvestments, exchangeInvestments, category]);

  // Ensure connected exchange accounts are hydrated when entering the screen.
  // Connection status is driven by GET /accounts (not local keys); if app-boot
  // hydration hasn't run yet (or raced), fetch the account list now so the
  // capsules + balances can load without re-linking.
  useEffect(() => {
    const authToken = useAppStore.getState().authToken;
    if (!authToken) return;
    if (exchangeAccounts.length > 0) return;
    useExchangeStore
      .getState()
      .hydrateExchangeAccounts(authToken)
      .catch(() => {
        // Non-fatal; error surfaced via the store's error field.
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load exchange balances when accounts become available (throttled to 1h).
  useEffect(() => {
    if (exchangeAccounts.length === 0) return;

    const authToken = useAppStore.getState().authToken;
    if (!authToken) return;

    const fetchExchangeBalances = useExchangeStore.getState().fetchExchangeBalances;
    for (const account of exchangeAccounts) {
      fetchExchangeBalances(account.id, authToken).catch(() => {
        // Errors are stored in the exchange store (state.error); silently
        // ignore here — the error banner is shown via exchangeNotice below.
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exchangeAccounts.length]);

  // Clear selected account if it no longer exists
  useEffect(() => {
    if (selectedAccountId && !investmentAccounts.find((acc) => acc.id === selectedAccountId)) {
      setSelectedAccountId(null);
    }
  }, [investmentAccounts, selectedAccountId]);

  // Filter further by selected account capsule
  const displayedInvestments = useMemo(() => {
    if (selectedAccountId) {
      return investments.filter((inv) => inv.accountId === selectedAccountId);
    }
    return investments;
  }, [investments, selectedAccountId]);

  // Show accounts that have holdings in the current category, plus any
  // exchange accounts that are still loading (so the capsule appears
  // immediately after hydrateExchangeAccounts completes).
  const filteredAccounts = useMemo(() => {
    if (!category || category === 'Transaction') return investmentAccounts;
    const accountIds = new Set(investments.map((inv) => inv.accountId));
    return investmentAccounts.filter(
      (acc) => accountIds.has(acc.id) || acc.type === 'Exchange',
    );
  }, [investmentAccounts, investments, category]);

  // Event handlers
  const handleAddAccount = () => {
    setShowConnectModal(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView 
        style={{ flex: 1 }} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <PerformanceSummary timeRange={selectedTimeRange} historyDaysLimit={historyDaysLimit} />
        <WaveChart
          selectedTimeRange={selectedTimeRange}
          historyDaysLimit={historyDaysLimit}
          onTimeRangeChange={setSelectedTimeRange}
        />
        
        {/* Exchange status notice — locked / rate-limited / sync failure */}
        {exchangeNotice && (
          <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor:
                  exchangeNotice.kind === 'error'
                    ? 'rgba(239, 68, 68, 0.08)'
                    : exchangeNotice.kind === 'locked'
                      ? colors.primarySoft
                      : colors.surfaceAlt,
                borderWidth: 1,
                borderColor:
                  exchangeNotice.kind === 'error'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : exchangeNotice.kind === 'locked'
                      ? colors.primary
                      : colors.border,
              }}
            >
              <Ionicons
                name={
                  exchangeNotice.kind === 'error'
                    ? 'warning-outline'
                    : exchangeNotice.kind === 'locked'
                      ? 'lock-closed-outline'
                      : 'information-circle-outline'
                }
                size={16}
                color={
                  exchangeNotice.kind === 'error'
                    ? colors.danger
                    : exchangeNotice.kind === 'locked'
                      ? colors.primary
                      : colors.textMuted
                }
              />
              <Text
                style={{
                  flex: 1,
                  color:
                    exchangeNotice.kind === 'error'
                      ? colors.danger
                      : exchangeNotice.kind === 'locked'
                        ? colors.primary
                        : colors.textMuted,
                  fontSize: 12,
                  fontWeight: '500',
                }}
              >
                {exchangeNotice.text}
              </Text>
            </View>
          </View>
        )}

        <AccountCapsules 
          accounts={filteredAccounts} 
          selectedAccountId={selectedAccountId} 
          onSelectAccount={setSelectedAccountId}
          onAddAccount={handleAddAccount}
        />
        <HoldingsList 
          investments={displayedInvestments} 
          selectedAccountId={selectedAccountId}
          isLoading={anyExchangeLoading && exchangeInvestments.length === 0}
        />

        {/* 為 TabNavigator 留空白 */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Connect Account Modal */}
      <ConnectAccountModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onPlaidPress={() => setShowPlaidModal(true)}
        onWeb3Press={() => {
          // Web3 wallet connection is handled directly by AppKit modal
          // No additional modal needed
        }}
        onExchangePress={() => setShowExchangeModal(true)}
      />

      {/* Plaid Link Modal */}
      <PlaidLinkModal
        isVisible={showPlaidModal}
        linkToken={plaidLinkToken}
        onClose={() => setShowPlaidModal(false)}
        onSuccess={() => setShowPlaidModal(false)}
      />

      {/* Exchange Link Modal */}
      <ExchangeLinkModal
        isOpen={showExchangeModal}
        onClose={() => setShowExchangeModal(false)}
        onSuccess={() => {
          // Exchange account connected successfully
          // You can add additional logic here if needed
        }}
      />
    </View>
  );
}
