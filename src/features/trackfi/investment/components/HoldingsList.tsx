import React, { memo, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import LoadingDots from '../../../../shared/components/LoadingDots';
import { useTranslation } from 'react-i18next';
import { logoDevImageSource } from '../../../../config/logodev';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';

interface Investment {
  id: string;
  symbol: string;
  logo: string;
  holdings: number;
  currentPrice: number;
  change24h: number;
  usdValue: number;
  type: 'crypto' | 'stock' | 'etf' | 'other';
}

type AssetClassFilter = 'All' | 'Stock' | 'ETF' | 'Crypto';

interface HoldingsListProps {
  investments: Investment[];
  selectedAccountId: string | null;
  isLoading?: boolean;
}

function HoldingRow({
  investment,
  totalValue,
}: {
  investment: Investment;
  totalValue: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const st = useMemo(() => makeRowStyles(colors), [colors]);
  const [logoFailed, setLogoFailed] = useState(false);

  const positionValue = investment.usdValue ?? (investment.holdings * investment.currentPrice);
  const pct = totalValue > 0 ? (positionValue / totalValue) * 100 : 0;
  const isPositive = (investment.change24h ?? 0) >= 0;
  const logoSource = logoDevImageSource(investment.logo);

  return (
    <View style={st.row}>
      <View style={st.icon}>
        {logoSource && !logoFailed ? (
          <Image
            source={logoSource}
            style={st.logo}
            resizeMode="cover"
            onError={() => setLogoFailed(true)}
          />
        ) : (
          <Text style={st.logoFallback}>{investment.symbol.slice(0, 1)}</Text>
        )}
      </View>
      <View style={st.body}>
        <Text style={st.title} numberOfLines={1}>{investment.symbol}</Text>
        <Text style={st.sub} numberOfLines={1}>
          {(investment.holdings ?? 0).toFixed(4)} {t('investments.units')} · {pct.toFixed(1)}%
        </Text>
      </View>
      <View style={st.right}>
        <Text style={st.amount}>
          {hideBalance ? HIDDEN_BALANCE_TEXT : money.value(positionValue)}
        </Text>
        <Text style={[st.change, { color: isPositive ? colors.success : colors.danger }]}>
          {isPositive ? '+' : ''}{(investment.change24h ?? 0).toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}

function areHoldingRowPropsEqual(
  prev: { investment: Investment; totalValue: number },
  next: { investment: Investment; totalValue: number },
): boolean {
  return (
    prev.totalValue === next.totalValue
    && prev.investment.id === next.investment.id
    && prev.investment.holdings === next.investment.holdings
    && prev.investment.currentPrice === next.investment.currentPrice
    && prev.investment.change24h === next.investment.change24h
    && prev.investment.usdValue === next.investment.usdValue
  );
}

const HoldingRowMemo = memo(HoldingRow, areHoldingRowPropsEqual);

export default function HoldingsList({
  investments,
  selectedAccountId,
  isLoading = false,
}: HoldingsListProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [selectedFilter, setSelectedFilter] = useState<AssetClassFilter>('All');

  const filteredInvestments = useMemo(
    () => investments
      .filter((inv) => {
        if (selectedFilter === 'All') return true;
        if (selectedFilter === 'Stock') return inv.type === 'stock';
        if (selectedFilter === 'ETF') return inv.type === 'etf';
        if (selectedFilter === 'Crypto') return inv.type === 'crypto';
        return true;
      })
      .sort((a, b) => {
        const valueA = a.usdValue ?? (a.holdings * a.currentPrice);
        const valueB = b.usdValue ?? (b.holdings * b.currentPrice);
        return valueB - valueA;
      }),
    [investments, selectedFilter],
  );

  const totalValue = useMemo(
    () => investments.reduce((sum, inv) => {
      const invValue = inv.usdValue ?? (inv.holdings * inv.currentPrice);
      return sum + invValue;
    }, 0),
    [investments],
  );

  const filterTabs: AssetClassFilter[] = ['All', 'Stock', 'ETF', 'Crypto'];

  const filterLabel = (filter: AssetClassFilter): string => {
    switch (filter) {
      case 'Stock': return t('investments.stock');
      case 'ETF': return t('investments.etf');
      case 'Crypto': return t('investments.crypto');
      default: return t('investments.all');
    }
  };

  const title = selectedAccountId
    ? t('investments.holdings')
    : t('investments.allHoldings');

  return (
    <View>
      <View style={st.header}>
        <Text style={st.sectionTitle}>
          {title} ({filteredInvestments.length})
        </Text>
      </View>

      <View style={st.filters}>
        {filterTabs.map((filter) => {
          const isActive = selectedFilter === filter;
          return (
            <TouchableOpacity
              key={filter}
              onPress={() => setSelectedFilter(filter)}
              style={[st.filterChip, isActive && st.filterChipActive]}
              activeOpacity={0.85}
            >
              <Text style={[st.filterText, isActive && st.filterTextActive]}>
                {filterLabel(filter)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={st.card}>
        {filteredInvestments.length > 0 ? (
          filteredInvestments.map((investment) => (
            <HoldingRowMemo
              key={investment.id}
              investment={investment}
              totalValue={totalValue}
            />
          ))
        ) : isLoading ? (
          <View style={st.empty}>
            <LoadingDots color={colors.primary} size={10} />
            <Text style={st.emptyText}>{t('investments.loadingHoldings')}</Text>
          </View>
        ) : (
          <View style={st.empty}>
            <Ionicons name="pie-chart-outline" size={28} color={colors.textFaint} />
            <Text style={st.emptyText}>{t('investments.noHoldingsFound')}</Text>
          </View>
        )}
        {isLoading && filteredInvestments.length > 0 ? (
          <View style={st.loadingMore}>
            <LoadingDots compact color={colors.primary} size={6} />
          </View>
        ) : null}
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
    filters: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      backgroundColor: 'transparent',
    },
    filterChipActive: {
      borderColor: c.primary,
      backgroundColor: c.primarySoft,
    },
    filterText: {
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '500',
    },
    filterTextActive: {
      color: c.primary,
      fontWeight: '700',
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
    loadingMore: {
      paddingVertical: 12,
      alignItems: 'center',
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
      backgroundColor: c.surfaceInput,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    logo: {
      width: 40,
      height: 40,
      borderRadius: 20,
    },
    logoFallback: {
      fontSize: 16,
      color: c.textMuted,
      fontWeight: '700',
    },
    body: { flex: 1, minWidth: 0 },
    title: { color: c.text, fontSize: 14, fontWeight: '600' },
    sub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    right: { alignItems: 'flex-end', gap: 2 },
    amount: { color: c.text, fontSize: 14, fontWeight: '600' },
    change: { fontSize: 11, fontWeight: '600' },
  });
}
