import React from 'react';
import { View, Text } from 'react-native';
import CurrencyDisplay from '../../../../shared/components/CurrencyDisplay';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import { useTranslation } from 'react-i18next';

interface NetWorthCardProps {
  totalBalance: number;
}

export default function NetWorthCard({ totalBalance }: NetWorthCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View className="mt-1 mb-4">
      <Text
        className="text-[11px] font-bold uppercase tracking-[0.3em]"
        style={{ color: colors.textMuted }}
      >
        {t('dashboard.netWorth')}
      </Text>
      <CurrencyDisplay 
        value={totalBalance} 
        fontSize={32}
        color={colors.text}
        style={{ marginTop: 8, fontWeight: 'bold' }}
      />
    </View>
  );
}
