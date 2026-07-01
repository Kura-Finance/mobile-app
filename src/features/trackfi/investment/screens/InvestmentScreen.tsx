import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import BrokersOverview from '../components/BrokersOverview';
import WaveChart from '../components/WaveChart';
import BrokersAccountList from '../components/BrokersAccountList';
import HoldingsList from '../components/HoldingsList';
import { useInitializePlaidData } from '../../../../shared/hooks/useInitializePlaidData';
import { useRefreshInvestmentData } from '../hooks/useRefreshInvestmentData';
import { useFinanceStore } from '../../../../shared/store/finance';
import { useExchangeStore } from '../../../../shared/store/useExchangeStore';
import { useAppStore } from '../../../../shared/store/useAppStore';
import { getAssetHistoryDaysLimit } from '../../../../shared/utils/membership';
import type { InvestmentCategory } from '../../../../shared/navigation/TabNavigator';
import { Ionicons } from '@expo/vector-icons';
import TrackFiLegalFooter from '../../components/TrackFiLegalFooter';
import { refreshTrackFiBrokerData } from '../../utils/refreshTrackFiBrokerData';
import {
  isPlaidBrokerHoldingsPending,
} from '../../utils/plaidBrokerHoldings';

interface InvestmentScreenProps {
  category?: InvestmentCategory;
  unlockSeq?: number;
}

function categoryFilter(type: string, category: InvestmentCategory | undefined): boolean {
  if (!category || category === 'Transaction') return true;
  switch (category) {
    case 'Stock': return type === 'stock' || type === 'etf' || type === 'crypto';
    case 'Crypto': return type === 'crypto';
    case 'DeFi': return type === 'other';
    default: return true;
  }
}

export default function InvestmentScreen({ category, unlockSeq = 0 }: InvestmentScreenProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const authToken = useAppStore((state) => state.authToken);

  const financeInvestmentAccounts = useFinanceStore((state) => state.investmentAccounts);
  const financeInvestments = useFinanceStore((state) => state.investments);
  const isLoadingPlaidData = useFinanceStore((state) => state.isLoadingPlaidData);
  const selectedTimeRange = useFinanceStore((state) => state.selectedTimeRange);
  const setSelectedTimeRange = useFinanceStore((state) => state.setSelectedTimeRange);
  const membershipLabel = useAppStore((state) => state.userProfile.membershipLabel);
  const historyDaysLimit = useMemo(
    () => getAssetHistoryDaysLimit(membershipLabel),
    [membershipLabel],
  );

  const exchangeAccounts = useExchangeStore((state) => state.exchangeAccounts);
  const exchangeInvestments = useExchangeStore((state) => state.exchangeInvestments);
  const exchangeIsLoading = useExchangeStore((state) => state.isLoading);
  const exchangeError = useExchangeStore((state) => state.error);

  useInitializePlaidData(true, unlockSeq);
  const { refreshing, handleRefresh } = useRefreshInvestmentData();

  const anyExchangeLoading = Object.values(exchangeIsLoading).some(Boolean);
  const plaidBrokerHoldingsPending = isPlaidBrokerHoldingsPending(
    financeInvestmentAccounts,
    financeInvestments,
  );
  const brokerHoldingsLoading =
    (anyExchangeLoading && exchangeAccounts.length > 0 && exchangeInvestments.length === 0) ||
    isLoadingPlaidData ||
    plaidBrokerHoldingsPending;

  const exchangeNotice = useMemo(() => {
    if (exchangeError) {
      if (/crypto session/i.test(exchangeError)) {
        return { kind: 'locked' as const, text: t('investments.exchangeLocked') };
      }
      return { kind: 'error' as const, text: t('investments.exchangeSyncFailed') };
    }
    return null;
  }, [exchangeError, t]);

  const investmentAccounts = useMemo(() => {
    const plaidAccounts = financeInvestmentAccounts.map((acc) => ({
      ...acc,
      type: (acc.type || 'Broker') as 'Broker' | 'Exchange' | 'Web3 Wallet',
    }));
    const exchangeAccountsFromStore = exchangeAccounts.map((acc) => ({
      id: acc.id,
      name: acc.exchangeDisplayName,
      logo: acc.icon,
      type: 'Exchange' as const,
    }));
    return [...plaidAccounts, ...exchangeAccountsFromStore];
  }, [financeInvestmentAccounts, exchangeAccounts]);

  const investments = useMemo(() => {
    const sources = [...financeInvestments, ...exchangeInvestments];
    return sources.filter((inv) => categoryFilter(inv.type, category));
  }, [financeInvestments, exchangeInvestments, category]);

  useEffect(() => {
    if (!authToken || unlockSeq === 0) return;
    void refreshTrackFiBrokerData(authToken, { force: true });
  }, [authToken, unlockSeq]);

  useEffect(() => {
    if (selectedAccountId && !investmentAccounts.find((acc) => acc.id === selectedAccountId)) {
      setSelectedAccountId(null);
    }
  }, [investmentAccounts, selectedAccountId]);

  const displayedInvestments = useMemo(() => {
    if (selectedAccountId) {
      return investments.filter((inv) => inv.accountId === selectedAccountId);
    }
    return investments;
  }, [investments, selectedAccountId]);

  const filteredAccounts = useMemo(() => {
    if (!category || category === 'Transaction') return investmentAccounts;
    const accountIds = new Set(investments.map((inv) => inv.accountId));
    return investmentAccounts.filter(
      (acc) => accountIds.has(acc.id) || acc.type === 'Exchange' || acc.type === 'Broker',
    );
  }, [investmentAccounts, investments, category]);

  return (
    <View style={st.root}>
      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <View style={st.portfolioCard}>
          <BrokersOverview
            timeRange={selectedTimeRange}
            historyDaysLimit={historyDaysLimit}
            isLoading={brokerHoldingsLoading}
            embedded
          />
          <WaveChart
            selectedTimeRange={selectedTimeRange}
            historyDaysLimit={historyDaysLimit}
            onTimeRangeChange={setSelectedTimeRange}
            embedded
          />
        </View>

        {exchangeNotice ? (
          <View style={[
            st.notice,
            exchangeNotice.kind === 'error' && st.noticeError,
            exchangeNotice.kind === 'locked' && st.noticeLocked,
          ]}>
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
            <Text style={[
              st.noticeText,
              exchangeNotice.kind === 'error' && { color: colors.danger },
              exchangeNotice.kind === 'locked' && { color: colors.primary },
            ]}>
              {exchangeNotice.text}
            </Text>
          </View>
        ) : null}

        <BrokersAccountList
          accounts={filteredAccounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={setSelectedAccountId}
        />
        <HoldingsList
          investments={displayedInvestments}
          selectedAccountId={selectedAccountId}
          isLoading={brokerHoldingsLoading}
        />
        <TrackFiLegalFooter />
      </ScrollView>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    scroll: { flex: 1 },
    content: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 120,
    },
    portfolioCard: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 12,
      paddingVertical: 12,
      marginBottom: 16,
    },
    notice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 12,
      backgroundColor: c.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      marginBottom: 16,
    },
    noticeError: {
      backgroundColor: 'rgba(239, 68, 68, 0.08)',
      borderColor: 'rgba(239, 68, 68, 0.2)',
    },
    noticeLocked: {
      backgroundColor: c.primarySoft,
      borderColor: c.primary,
    },
    noticeText: {
      flex: 1,
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '500',
    },
  });
}
