import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { useAppStore } from '../../../../shared/store/useAppStore';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import { useBankingStats } from '../hooks/useBankingStats';
import type { Account } from '../../../../shared/store/finance';

interface Props {
  accounts: Account[];
}

export default function BankingAccountsOverview({ accounts }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const setHideBalance = useAppStore((s) => s.setHideBalance);
  const st = useMemo(() => makeStyles(colors), [colors]);
  const stats = useBankingStats(accounts);

  const showCreditColumn = stats.creditAccounts.length > 0;
  const rightLabel = stats.hasCreditLimit
    ? t('trackfi.banking.availableCredit')
    : t('trackfi.banking.creditUsed');
  const rightAmount = stats.hasCreditLimit ? stats.availableCredit : stats.creditUsed;
  const rightPill = stats.hasCreditLimit && stats.totalCreditLimit > 0
    ? t('trackfi.banking.creditUtilization', {
        pct: Math.round(stats.creditUtilPct ?? 0),
        limit: money.value(stats.totalCreditLimit),
      })
    : t('trackfi.banking.creditAccountCount', { count: stats.creditAccounts.length });

  return (
    <View style={st.card}>
      <View style={st.header}>
        <Text style={st.title}>{t('trackfi.banking.accountsOverview')}</Text>
        <TouchableOpacity
          onPress={() => setHideBalance(!hideBalance)}
          hitSlop={8}
          activeOpacity={0.7}
          style={st.hideBtn}
        >
          <Ionicons
            name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
            size={14}
            color={colors.textFaint}
          />
          <Text style={st.hideText}>{t('trackfi.banking.hideBalances')}</Text>
        </TouchableOpacity>
      </View>

      <View style={st.statsRow}>
        <View style={st.stat}>
          <Text style={st.statLabel}>{t('trackfi.banking.totalBalance')}</Text>
          <Text style={st.statValue}>
            {hideBalance ? HIDDEN_BALANCE_TEXT : money.value(stats.netBalance)}
          </Text>
          <View style={st.pillPrimary}>
            <Text style={st.pillPrimaryText}>{t('trackfi.banking.netBalance')}</Text>
          </View>
        </View>

        {showCreditColumn ? (
          <View style={st.stat}>
            <Text style={st.statLabel}>{rightLabel}</Text>
            <Text style={st.statValue}>
              {hideBalance || rightAmount == null
                ? HIDDEN_BALANCE_TEXT
                : money.value(rightAmount)}
            </Text>
            <View style={st.pillSuccess}>
              <Text style={st.pillSuccessText} numberOfLines={1}>{rightPill}</Text>
            </View>
          </View>
        ) : null}
      </View>

      {stats.hasCreditLimit && stats.creditUtilPct != null ? (
        <View style={st.progressTrack}>
          <View
            style={[
              st.progressFill,
              { width: `${Math.max(4, stats.creditUtilPct)}%` as `${number}%` },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 16,
      marginBottom: 16,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    title: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
    },
    hideBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    hideText: {
      color: c.textFaint,
      fontSize: 12,
      fontWeight: '500',
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    stat: {
      flex: 1,
      gap: 4,
    },
    statLabel: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '500',
    },
    statValue: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: -0.5,
    },
    pillPrimary: {
      alignSelf: 'flex-start',
      backgroundColor: c.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 2,
    },
    pillPrimaryText: {
      color: c.primary,
      fontSize: 10,
      fontWeight: '600',
    },
    pillSuccess: {
      alignSelf: 'flex-start',
      backgroundColor: `${c.success}18`,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 2,
      maxWidth: '100%',
    },
    pillSuccessText: {
      color: c.success,
      fontSize: 10,
      fontWeight: '600',
    },
    progressTrack: {
      height: 6,
      borderRadius: 999,
      backgroundColor: c.surfaceInput,
      marginTop: 14,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 999,
      backgroundColor: c.primary,
    },
  });
}
