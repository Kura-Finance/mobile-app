import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { Transaction } from '../../../../shared/store/useFinanceStore';
import CurrencyDisplay from '../../../../shared/components/CurrencyDisplay';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import { resolveTransactionCategory } from '../../utils/transactionCategory';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
}

interface CategoryTotal {
  category: string;
  amount: number;
  count: number;
}

/** Spending = money out (credit / transfer); everything else (deposit) is income. */
function isExpenseTx(type: string): boolean {
  return type === 'credit' || type === 'transfer';
}

function aggregate(
  transactions: Transaction[],
  uncategorizedLabel: string,
  labelForCode?: (code: string) => string | undefined,
) {
  const spendingMap = new Map<string, CategoryTotal>();
  const incomeMap = new Map<string, CategoryTotal>();
  let totalSpending = 0;
  let totalIncome = 0;

  for (const tx of transactions) {
    const amount = Math.abs(Number(tx.amount) || 0);
    if (amount === 0) continue;
    const category = resolveTransactionCategory(tx, uncategorizedLabel, labelForCode);
    const target = isExpenseTx(tx.type) ? spendingMap : incomeMap;
    const existing = target.get(category);
    if (existing) {
      existing.amount += amount;
      existing.count += 1;
    } else {
      target.set(category, { category, amount, count: 1 });
    }
    if (isExpenseTx(tx.type)) totalSpending += amount;
    else totalIncome += amount;
  }

  const toSortedList = (m: Map<string, CategoryTotal>) =>
    Array.from(m.values()).sort((a, b) => b.amount - a.amount);

  return {
    spending: toSortedList(spendingMap),
    income: toSortedList(incomeMap),
    totalSpending,
    totalIncome,
  };
}

export default function BudgetModal({ isOpen, onClose, transactions }: BudgetModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const { spending, income, totalSpending, totalIncome } = useMemo(() => {
    const labelForCode = (code: string) => {
      const key = `dashboard.pfc.${code}`;
      const translated = t(key, { defaultValue: '' });
      return translated || undefined;
    };
    return aggregate(transactions, t('dashboard.uncategorized'), labelForCode);
  }, [transactions, t]);

  const net = totalIncome - totalSpending;
  const hasData = spending.length > 0 || income.length > 0;

  const renderSection = (
    title: string,
    rows: CategoryTotal[],
    total: number,
    accent: string,
  ) => {
    if (rows.length === 0) return null;
    const max = rows[0]?.amount || 1;
    return (
      <View style={{ marginTop: 24 }}>
        <Text style={styles(colors).sectionLabel}>{title}</Text>
        <View style={styles(colors).card}>
          {rows.map((row, i) => {
            const pctOfTotal = total > 0 ? (row.amount / total) * 100 : 0;
            const barWidth = `${Math.max(4, (row.amount / max) * 100)}%` as const;
            return (
              <View
                key={row.category}
                style={[
                  styles(colors).row,
                  i === rows.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles(colors).rowTop}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles(colors).categoryName} numberOfLines={1}>
                      {row.category}
                    </Text>
                    <Text style={styles(colors).categoryMeta}>
                      {t('dashboard.txCount', { count: row.count })} · {pctOfTotal.toFixed(0)}%
                    </Text>
                  </View>
                  <CurrencyDisplay
                    value={row.amount}
                    fontSize={15}
                    color={colors.text}
                    style={{ fontWeight: '700' }}
                  />
                </View>
                <View style={styles(colors).barTrack}>
                  <View style={[styles(colors).barFill, { width: barWidth, backgroundColor: accent }]} />
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={isOpen}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header — explicit top inset; SafeAreaView inside Modal is unreliable */}
        <View style={[styles(colors).header, { paddingTop: insets.top + 12 }]}>
          <Text style={styles(colors).headerTitle}>{t('dashboard.budget')}</Text>
          <TouchableOpacity onPress={onClose} style={styles(colors).closeBtn}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 24,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles(colors).subtitle}>{t('dashboard.budgetByCategory')}</Text>

          {/* Summary card */}
          <View style={styles(colors).summaryCard}>
            <View style={styles(colors).summaryItem}>
              <Text style={styles(colors).summaryLabel}>{t('dashboard.income')}</Text>
              <CurrencyDisplay value={totalIncome} fontSize={18} color="#10B981" style={{ fontWeight: '700' }} />
            </View>
            <View style={styles(colors).summaryDivider} />
            <View style={styles(colors).summaryItem}>
              <Text style={styles(colors).summaryLabel}>{t('dashboard.spending')}</Text>
              <CurrencyDisplay value={totalSpending} fontSize={18} color="#EF4444" style={{ fontWeight: '700' }} />
            </View>
            <View style={styles(colors).summaryDivider} />
            <View style={styles(colors).summaryItem}>
              <Text style={styles(colors).summaryLabel}>{t('dashboard.net')}</Text>
              <CurrencyDisplay
                value={net}
                fontSize={18}
                color={net >= 0 ? '#10B981' : '#EF4444'}
                style={{ fontWeight: '700' }}
              />
            </View>
          </View>

          {!hasData && (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('dashboard.noBudgetData')}</Text>
            </View>
          )}

          {renderSection(t('dashboard.spendingByCategory'), spending, totalSpending, colors.danger)}
          {renderSection(t('dashboard.incomeByCategory'), income, totalIncome, colors.success)}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = (c: ReturnType<typeof useTheme>['colors']) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: 20,
      paddingBottom: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: c.text, letterSpacing: -0.3 },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    subtitle: { color: c.textMuted, fontSize: 13, marginBottom: 16 },

    summaryCard: {
      flexDirection: 'row',
      backgroundColor: c.surfaceAlt,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingVertical: 16,
    },
    summaryItem: { flex: 1, alignItems: 'center', gap: 6 },
    summaryDivider: { width: StyleSheet.hairlineWidth, backgroundColor: c.border, marginVertical: 4 },
    summaryLabel: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },

    sectionLabel: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
      marginLeft: 4,
    },
    card: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
    },
    row: {
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 10,
    },
    rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    categoryName: { color: c.text, fontSize: 15, fontWeight: '600' },
    categoryMeta: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    barTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: c.surfaceInput,
      overflow: 'hidden',
    },
    barFill: { height: 6, borderRadius: 3 },
  });
