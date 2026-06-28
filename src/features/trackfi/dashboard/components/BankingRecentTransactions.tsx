import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import type { Transaction } from '../../../../shared/store/useFinanceStore';

interface Props {
  transactions: Transaction[];
  onViewAll: () => void;
}

function txIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'deposit') return 'arrow-down-circle-outline';
  if (type === 'transfer') return 'swap-horizontal-outline';
  return 'cart-outline';
}

function accountTypeLabel(
  type: Transaction['accountType'],
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (type === 'credit') return t('dashboard.creditShort');
  if (type === 'saving') return t('accounts.savings');
  if (type === 'checking') return t('accounts.checking');
  return type.toUpperCase();
}

function TransactionRow({ tx }: { tx: Transaction }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const st = useMemo(() => makeRowStyles(colors), [colors]);
  const isExpense = tx.type === 'credit' || tx.type === 'transfer';
  const amount = parseFloat(tx.amount) || 0;

  return (
    <View style={st.row}>
      <View style={[st.icon, { backgroundColor: isExpense ? colors.primarySoft : `${colors.success}18` }]}>
        <Ionicons
          name={txIcon(tx.type)}
          size={18}
          color={isExpense ? colors.primary : colors.success}
        />
      </View>
      <View style={st.body}>
        <Text style={st.title} numberOfLines={1}>{tx.merchant}</Text>
        <Text style={st.sub} numberOfLines={1}>
          {tx.date} · {accountTypeLabel(tx.accountType, t)}
        </Text>
      </View>
      <Text style={[st.amount, !isExpense && { color: colors.success }]}>
        {hideBalance
          ? HIDDEN_BALANCE_TEXT
          : `${isExpense ? '-' : '+'}${money.value(amount)}`}
      </Text>
    </View>
  );
}

export default function BankingRecentTransactions({ transactions, onViewAll }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  const recent = useMemo(
    () => [...transactions]
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
      .slice(0, 4),
    [transactions],
  );

  return (
    <View>
      <View style={st.header}>
        <Text style={st.sectionTitle}>{t('dashboard.recentTransactions')}</Text>
        <TouchableOpacity onPress={onViewAll} activeOpacity={0.7}>
          <Text style={st.sectionLink}>{t('dashboard.viewAll')}</Text>
        </TouchableOpacity>
      </View>

      <View style={st.card}>
        {recent.length > 0 ? (
          recent.map((tx) => (
            <TransactionRow key={String(tx.id)} tx={tx} />
          ))
        ) : (
          <View style={st.empty}>
            <Ionicons name="receipt-outline" size={28} color={colors.textFaint} />
            <Text style={st.emptyText}>{t('dashboard.noActivity')}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
    },
    sectionLink: {
      color: c.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    card: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingVertical: 4,
    },
    empty: {
      alignItems: 'center',
      paddingVertical: 32,
      gap: 8,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: '500',
    },
  });
}

function makeRowStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 10,
    },
    icon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { flex: 1, minWidth: 0 },
    title: { color: c.text, fontSize: 14, fontWeight: '600' },
    sub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    amount: { color: c.text, fontSize: 14, fontWeight: '600' },
  });
}
