import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import HoldingCard from './HoldingCard';
import { useTheme } from '../../../../shared/theme/ThemeContext';

interface Investment {
  id: string;
  symbol: string;
  logo: string;
  holdings: number;
  currentPrice: number;
  change24h: number;
  usdValue: number; // USD value from exchange data
  type: 'crypto' | 'stock' | 'etf' | 'other';
}

type AssetClassFilter = 'All' | 'Stock' | 'ETF' | 'Crypto';

interface HoldingsListProps {
  investments: Investment[];
  selectedAccountId: string | null;
  /** True while exchange balances are being fetched for the first time. */
  isLoading?: boolean;
}

export default function HoldingsList({ investments, selectedAccountId, isLoading = false }: HoldingsListProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [selectedFilter, setSelectedFilter] = useState<AssetClassFilter>('All');

  // Filter investments based on selected asset class
  const filteredInvestments = investments
    .filter((inv) => {
      if (selectedFilter === 'All') return true;
      if (selectedFilter === 'Stock') return inv.type === 'stock';
      if (selectedFilter === 'ETF') return inv.type === 'etf';
      if (selectedFilter === 'Crypto') return inv.type === 'crypto';
      return true;
    })
    // Sort by total value in descending order
    .sort((a, b) => {
      const valueA = a.usdValue ?? (a.holdings * a.currentPrice);
      const valueB = b.usdValue ?? (b.holdings * b.currentPrice);
      return valueB - valueA;
    });
  
  // Calculate total portfolio value
  const totalValue = investments.reduce((sum, inv) => {
    const invValue = inv.usdValue ?? (inv.holdings * inv.currentPrice);
    return sum + invValue;
  }, 0);

  const filterTabs: AssetClassFilter[] = ['All', 'Stock', 'ETF', 'Crypto'];

  const filterLabel = (filter: AssetClassFilter): string => {
    switch (filter) {
      case 'Stock':
        return t('investments.stock');
      case 'ETF':
        return t('investments.etf');
      case 'Crypto':
        return t('investments.crypto');
      default:
        return t('investments.all');
    }
  };

  return (
    <View style={{ paddingHorizontal: 16 }}>
      <View style={{ marginBottom: 16 }}>
        <Text style={{ color: colors.text, fontSize: 16, fontWeight: '700', marginBottom: 12, letterSpacing: -0.3 }}>
          {selectedAccountId ? `${t('investments.holdings')} (${filteredInvestments.length})` : `${t('investments.allHoldings')} (${filteredInvestments.length})`}
        </Text>

        {/* Asset Class Filter Tabs */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          {filterTabs.map((filter) => {
            const isActive = selectedFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => setSelectedFilter(filter)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isActive ? colors.primary : colors.border,
                  backgroundColor: isActive ? colors.primarySoft : 'transparent',
                }}
              >
                <Text
                  style={{
                    color: isActive ? colors.primary : colors.textMuted,
                    fontSize: 12,
                    fontWeight: isActive ? '700' : '500',
                  }}
                >
                  {filterLabel(filter)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {filteredInvestments.length > 0 ? (
        <View style={{ gap: 12 }}>
          {filteredInvestments.map((investment) => (
            <HoldingCard key={investment.id} investment={investment} totalValue={totalValue} />
          ))}
          {isLoading && (
            <View style={{ paddingVertical: 12, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </View>
      ) : isLoading ? (
        <View style={{ paddingVertical: 32, alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t('investments.loadingHoldings')}</Text>
        </View>
      ) : (
        <View style={{ paddingVertical: 24, alignItems: 'center', paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt }}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>{t('investments.noHoldingsFound')}</Text>
        </View>
      )}
    </View>
  );
}
