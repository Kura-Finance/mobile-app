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
import LoadingDots from '../../../../shared/components/LoadingDots';

interface Props {
  totalUsdValue: number;
  walletCount: number;
  isLoading?: boolean;
}

export default function DefiOverview({ totalUsdValue, walletCount, isLoading = false }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const setHideBalance = useAppStore((s) => s.setHideBalance);
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={st.card}>
      <View style={st.header}>
        <Text style={st.title}>{t('trackfi.defi.portfolioOverview')}</Text>
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
          <Text style={st.statLabel}>{t('trackfi.defi.totalOnChain')}</Text>
          {isLoading ? (
            <LoadingDots color={colors.text} size={10} />
          ) : (
            <Text style={st.statValue}>
              {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(totalUsdValue)}
            </Text>
          )}
          <View style={st.pill}>
            <Text style={st.pillText}>
              {t('trackfi.defiPortfolio.walletCount', { count: walletCount })}
            </Text>
          </View>
        </View>
      </View>
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
    pill: {
      alignSelf: 'flex-start',
      backgroundColor: c.primarySoft,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
      marginTop: 2,
    },
    pillText: {
      color: c.primary,
      fontSize: 10,
      fontWeight: '600',
    },
  });
}
