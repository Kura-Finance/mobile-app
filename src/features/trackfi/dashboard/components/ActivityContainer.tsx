import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import type { Transaction } from '../../../../shared/store/useFinanceStore';
import CurrencyDisplay from '../../../../shared/components/CurrencyDisplay';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

interface ActivityContainerProps {
  transactions: Transaction[];
  transactionHeader: string;
  isAiOptedIn: boolean;
  onToggleAiOptIn: () => void;
  onViewAll: () => void;
}

export default function ActivityContainer({
  transactions,
  transactionHeader,
  isAiOptedIn,
  onToggleAiOptIn,
  onViewAll,
}: ActivityContainerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: 20, backgroundColor: colors.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 20, height: 345, marginHorizontal: 16, marginBottom: 32, marginTop: 0 }}>
        <View style={{ marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', letterSpacing: -0.3 }}>{transactionHeader}</Text>
          <TouchableOpacity onPress={onViewAll}>
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>{t('dashboard.viewAll')}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView 
          style={{ flex: 1 }} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 8, minHeight: 280 }}
          nestedScrollEnabled={true}
        >
          <View style={{ gap: 12 }}>
            {transactions.slice(0, 4).map((transaction) => {
              const isExpense = transaction.type === 'credit' || transaction.type === 'transfer';

              return (
                <View key={transaction.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 0 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceInput, justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Text>{transaction.type === 'deposit' ? '💰' : transaction.type === 'transfer' ? '🔄' : '🛍️'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>{transaction.merchant}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{transaction.date}</Text>
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textFaint }} />
                        <Text style={{ color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          {transaction.accountType === 'saving'
                            ? t('accounts.savings')
                            : transaction.accountType === 'checking'
                              ? t('accounts.checking')
                              : transaction.accountType === 'credit'
                                ? t('dashboard.creditShort')
                                : t('investments.crypto')}
                        </Text>
                      </View>
                    </View>
                  </View>
                  <Text style={{ color: isExpense ? colors.text : colors.success, fontSize: 14, fontWeight: '500', fontFamily: 'monospace' }}>
                    {isExpense ? '-' : '+'}
                  </Text>
                  <CurrencyDisplay
                    value={Number(transaction.amount)}
                    fontSize={14}
                    color={isExpense ? colors.text : colors.success}
                    style={{ fontFamily: 'monospace', fontWeight: '500' }}
                  />
                </View>
              );
            })}

            {transactions.length === 0 && (
              <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('dashboard.noActivity')}</Text>
              </View>
            )}
          </View>
        </ScrollView>
    </View>
  );
}
