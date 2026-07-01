import React, { useMemo } from 'react';
import { Alert, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import LoadingDots from '../../../shared/components/LoadingDots';
import { useHideBalance } from '../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../shared/utils/privacyDisplay';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';

interface Props {
  availableCreditUsd: number;
  totalCollateralUsd: number;
  loading?: boolean;
}

export default function BorrowCreditCard({
  availableCreditUsd,
  totalCollateralUsd,
  loading = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();

  return (
    <View style={st.wrap}>
      <View style={st.card}>
        <TouchableOpacity
          style={st.balanceLabelRow}
          onPress={() =>
            Alert.alert(
              t('crypto.borrowAvailableCredit'),
              t('crypto.borrowAvailableCreditHint'),
            )
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('crypto.borrowAvailableCreditHint')}
        >
          <Text style={st.balanceLabel}>{t('crypto.borrowAvailableCredit')}</Text>
          <Ionicons name="information-circle-outline" size={14} color={colors.textFaint} />
        </TouchableOpacity>

        <View style={st.balanceValueWrap}>
          {loading ? (
            <LoadingDots color={colors.text} size={10} />
          ) : (
            <Text style={st.balanceValue}>
              {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(availableCreditUsd)}
            </Text>
          )}
          {!loading && !hideBalance ? (
            <Text style={st.collateralSub}>
              {t('crypto.borrowTotalCollateralValue', {
                amount: money.compact(totalCollateralUsd),
              })}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    card: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 8,
    },
    balanceLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    balanceLabel: {
      color: c.textFaint,
      fontSize: 13,
      fontWeight: '500',
    },
    balanceValueWrap: {
      minHeight: 52,
      justifyContent: 'center',
    },
    balanceValue: {
      color: c.text,
      fontSize: 36,
      fontWeight: '700',
      letterSpacing: -1,
    },
    collateralSub: {
      color: c.textMuted,
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
    },
  });
}
