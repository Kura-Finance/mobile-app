import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { logoDevImageSource } from '../../../../config/logodev';
import CurrencyDisplay from '../../../../shared/components/CurrencyDisplay';
import { useTheme } from '../../../../shared/theme/ThemeContext';

interface Investment {
  id: string;
  symbol: string;
  logo: string;
  holdings: number;
  currentPrice: number;
  change24h: number;
  usdValue: number; // USD value from exchange data or calculated
}

interface HoldingCardProps {
  investment: Investment;
  totalValue: number;
}

export default function HoldingCard({ investment, totalValue }: HoldingCardProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [logoFailed, setLogoFailed] = useState(false);

  // Reset the error state when the logo changes (recycled rows).
  useEffect(() => { setLogoFailed(false); }, [investment.logo]);

  // Use usdValue directly from investment
  const positionValue = investment.usdValue ?? (investment.holdings * investment.currentPrice);
  const percentageOfTotal = totalValue > 0 ? (positionValue / totalValue) * 100 : 0;
  const isPositive = (investment.change24h ?? 0) >= 0;

  const logoSource = logoDevImageSource(investment.logo);

  return (
    <TouchableOpacity
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: colors.surfaceAlt,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceInput, alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' }}>
          {logoSource && !logoFailed ? (
            <Image
              source={logoSource}
              style={{ width: 40, height: 40, borderRadius: 20 }}
              resizeMode="cover"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Text style={{ fontSize: 16, color: colors.textMuted, fontWeight: '700' }}>
              {(investment.symbol ?? '?').slice(0, 1)}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>{investment.symbol}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{(investment.holdings ?? 0).toFixed(4)} {t('investments.units')} • {(percentageOfTotal ?? 0).toFixed(1)}%</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 3 }}>
        <CurrencyDisplay 
          value={positionValue} 
          fontSize={15}
          color={colors.text}
          style={{ fontWeight: '700' }}
        />
        <Text style={{ color: isPositive ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: '600' }}>
          {isPositive ? '+' : ''}{(investment.change24h ?? 0).toFixed(2)}%
        </Text>
      </View>
    </TouchableOpacity>
  );
}
