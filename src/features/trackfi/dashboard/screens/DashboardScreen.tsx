import React, { useMemo, useState } from 'react';
import { ScrollView, RefreshControl, StyleSheet } from 'react-native';
import { View as SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useFinanceStore } from '../../../../shared/store/useFinanceStore';
import BankingAccountsOverview from '../components/BankingAccountsOverview';
import BankingAccountList from '../components/BankingAccountList';
import BankingRecentTransactions from '../components/BankingRecentTransactions';
import BankingInsights from '../components/BankingInsights';
import InsightsModal from '../components/InsightsModal';
import TransactionsDetailModal from '../components/TransactionsDetailModal';
import TrackFiLegalFooter from '../../components/TrackFiLegalFooter';
import { useInitializePlaidData } from '../../../../shared/hooks/useInitializePlaidData';
import { useRefreshDashboardData } from '../hooks/useRefreshDashboardData';
import { useTheme } from '../../../../shared/theme/ThemeContext';

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const [showAllTransactions, setShowAllTransactions] = useState(false);
  const [showInsights, setShowInsights] = useState(false);

  const accounts = useFinanceStore((state) => state.accounts);
  const transactions = useFinanceStore((state) => state.transactions);

  useInitializePlaidData();
  const { refreshing, handleRefresh } = useRefreshDashboardData();

  const bankingAccounts = useMemo(
    () => accounts.filter((a) => a.type === 'checking' || a.type === 'saving' || a.type === 'credit'),
    [accounts],
  );

  return (
    <SafeAreaView style={st.root}>
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
        <BankingAccountsOverview accounts={bankingAccounts} />
        <BankingAccountList accounts={bankingAccounts} />
        <BankingRecentTransactions
          transactions={transactions}
          onViewAll={() => setShowAllTransactions(true)}
        />
        <BankingInsights onPress={() => setShowInsights(true)} />
        <TrackFiLegalFooter />
      </ScrollView>

      <InsightsModal
        isOpen={showInsights}
        onClose={() => setShowInsights(false)}
        transactions={transactions}
      />

      <TransactionsDetailModal
        isOpen={showAllTransactions}
        onClose={() => setShowAllTransactions(false)}
        account={{ id: 'all', type: 'all', name: t('dashboard.allAccounts') }}
        transactions={transactions}
      />
    </SafeAreaView>
  );
}

function makeStyles(c: { background: string }) {
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
  });
}
