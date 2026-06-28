import React, { useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Transaction } from '../../../../shared/store/useFinanceStore';
import CurrencyDisplay from '../../../../shared/components/CurrencyDisplay';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useTranslation } from 'react-i18next';

interface TransactionsDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: any;
  transactions: Transaction[];
}

export default function TransactionsDetailModal({ 
  isOpen, 
  onClose, 
  account, 
  transactions 
}: TransactionsDetailModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const st = useMemo(() => makeStyles(colors), [colors]);
  if (!account) return null;

  const accountType = (account as any).type;
  // Always use purple color
  const accentColors = [colors.primary, colors.primaryDark] as const;

  const accountTypeLabel = accountType === 'all'
    ? t('dashboard.allAccounts')
    : accountType === 'credit'
      ? t('accounts.creditCard')
      : accountType === 'saving'
        ? t('accounts.savings')
        : accountType === 'checking'
          ? t('accounts.checking')
          : t('dashboard.account');

  const balance = (account as any).balance ?? 0;
  const balanceValue = accountType === 'credit' || accountType === 'all'
    ? -balance
    : balance;

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[st.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={st.header}>
          <Text style={st.headerTitle}>{t('dashboard.transactions')}</Text>
          <TouchableOpacity onPress={onClose} style={st.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={st.scroll}
          contentContainerStyle={st.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Account Card */}
          {accountType !== 'all' && (
            <View style={{ marginBottom: 24 }}>
              <LinearGradient
                colors={accentColors}
                style={{
                  borderRadius: 16,
                  padding: 16,
                  borderWidth: 2,
                  borderColor: colors.surface,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: 0.3,
                  shadowRadius: 20,
                  elevation: 5,
                }}
              >
                {/* Top Row: Account name (left) and Balance (right) */}
                <View 
                  style={{
                    display: 'flex',
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: 12,
                  }}
                >
                  {/* Left: Account Name */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: '#999999', fontWeight: '600' }} numberOfLines={1}>
                      {(account as any).name}
                    </Text>
                  </View>
                  {/* Right: Balance */}
                  <CurrencyDisplay
                    value={balanceValue}
                    fontSize={18}
                    color="#FFFFFF"
                    style={{ marginLeft: 16, fontWeight: '700' }}
                  />
                </View>

                {/* Bottom Row: Account Type */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' }}>
                  <Text 
                    style={{
                      fontSize: 11,
                      color: '#999999',
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      letterSpacing: 0.28,
                    }}
                  >
                    {accountTypeLabel}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          )}

          {/* All Accounts Header - when account type is 'all' */}
          {accountType === 'all' && (
            <View style={st.allAccountsHeader}>
              <Text style={st.allAccountsTitle}>{t('dashboard.allAccounts')}</Text>
              <Text style={st.allAccountsMeta}>
                {t('dashboard.txCount', { count: transactions.length })}
              </Text>
            </View>
          )}

          {/* Transactions List */}
          <View style={{ gap: 12 }}>
            {transactions.length > 0 ? (
              transactions.map((transaction) => {
                const isExpense = transaction.type === 'credit' || transaction.type === 'transfer';
                const amount = Math.abs(Number(transaction.amount));

                return (
                  <View key={transaction.id} style={st.txRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 }}>
                      {/* Icon */}
                      <View
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 20,
                          backgroundColor: colors.surfaceInput,
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 12,
                        }}
                      >
                        <Text>{transaction.type === 'deposit' ? '💰' : transaction.type === 'transfer' ? '🔄' : '🛍️'}</Text>
                      </View>

                      {/* Merchant & Meta */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontSize: 14, fontWeight: '500' }} numberOfLines={1}>
                          {transaction.merchant}
                        </Text>
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

                    <View style={st.txAmountRow}>
                      <Text style={[st.txSign, { color: isExpense ? colors.text : colors.success }]}>
                        {isExpense ? '−' : '+'}
                      </Text>
                      <CurrencyDisplay
                        value={amount}
                        fontSize={14}
                        color={isExpense ? colors.text : colors.success}
                        style={st.txAmount}
                      />
                    </View>
                  </View>
                );
              })
            ) : (
              <View style={st.empty}>
                <Text style={st.emptyText}>{t('dashboard.noActivity')}</Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={st.footer}>
          <TouchableOpacity onPress={onClose} style={st.doneBtn} activeOpacity={0.85}>
            <Text style={st.doneText}>{t('dashboard.done')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
    },
    closeBtn: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 24,
    },
    allAccountsHeader: {
      marginBottom: 24,
    },
    allAccountsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
      marginBottom: 4,
    },
    allAccountsMeta: {
      fontSize: 12,
      color: c.textMuted,
    },
    txRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 12,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    txAmountRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    txSign: {
      fontSize: 14,
      fontWeight: '500',
      fontFamily: 'monospace',
    },
    txAmount: {
      fontFamily: 'monospace',
      fontWeight: '500',
    },
    empty: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 14,
    },
    footer: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    doneBtn: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    doneText: {
      color: c.primary,
      fontSize: 16,
      fontWeight: '600',
    },
  });
}
