import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import { useFavoritesStore } from '../store/useFavoritesStore';
import type { PortfolioToken } from '../hooks/usePortfolio';
import type { BluechipToken } from '../config/blueChips';
import TokenLogo from './TokenLogo';

export function formatTokenHoldings(n: number, symbol: string): string {
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.001) return `${n.toExponential(2)} ${symbol}`;
  if (n < 1) return `${n.toFixed(4)} ${symbol}`;
  if (n < 1000) return `${n.toFixed(2)} ${symbol}`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${symbol}`;
}

interface Props {
  item: PortfolioToken;
  onPress: (token: BluechipToken) => void;
  showFavorite?: boolean;
  dimUnheld?: boolean;
}

export default function PortfolioTokenRow({
  item,
  onPress,
  showFavorite = true,
  dimUnheld = true,
}: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const money = useMoneyFormat();
  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const { token, price, change24h, holdings, value } = item;
  const hasHoldings = holdings > 0;
  const isPositive = change24h >= 0;
  const isFav = favorites.includes(token.symbol);

  return (
    <TouchableOpacity
      style={[st.row, dimUnheld && !hasHoldings && !isFav && st.rowDimmed]}
      onPress={() => onPress(token)}
      activeOpacity={0.65}
    >
      <View style={st.logoContainer}>
        <TokenLogo token={token} size={44} />
        {token.badge && (
          <View style={[st.badge, { backgroundColor: token.color }]}>
            <Text style={st.badgeText}>{token.badge}</Text>
          </View>
        )}
      </View>

      <View style={st.mid}>
        <View style={st.nameRow}>
          <Text style={st.symbol}>{token.displayName}</Text>
        </View>
        <View style={st.priceRow}>
          <Text style={st.price}>{money.price(price)}</Text>
          <Text style={[st.change, isPositive ? st.changePos : st.changeNeg]}>
            {isPositive ? '▲' : '▼'} {Math.abs(change24h).toFixed(2)}%
          </Text>
        </View>
      </View>

      <View style={st.right}>
        {hasHoldings ? (
          <>
            <Text style={st.value}>{money.compact(value)}</Text>
            <Text style={st.holdings}>{formatTokenHoldings(holdings, token.displayName)}</Text>
          </>
        ) : (
          <Text style={st.noHoldings}>—</Text>
        )}
      </View>

      {showFavorite && (
        <TouchableOpacity
          style={st.starBtn}
          onPress={() => toggleFavorite(token.symbol)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Ionicons
            name={isFav ? 'star' : 'star-outline'}
            size={18}
            color={isFav ? '#F5AC37' : colors.textFaint}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 12,
    },
    rowDimmed: { opacity: 1 },
    logoContainer: { position: 'relative', width: 44, height: 44 },
    badge: {
      position: 'absolute',
      bottom: -2,
      right: -4,
      borderRadius: 6,
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderWidth: 2,
      borderColor: c.surfaceAlt,
      minWidth: 20,
      alignItems: 'center',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    mid: { flex: 1, gap: 4 },
    symbol: { color: c.text, fontSize: 15, fontWeight: '700' },
    priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    price: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
    change: { fontSize: 11, fontWeight: '600' },
    changePos: { color: '#10B981' },
    changeNeg: { color: '#EF4444' },
    starBtn: { width: 28, alignItems: 'center', justifyContent: 'center' },
    right: { alignItems: 'flex-end', gap: 3 },
    value: { color: c.text, fontSize: 15, fontWeight: '700' },
    holdings: {
      color: c.textMuted,
      fontSize: 12,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    noHoldings: { color: c.textFaint, fontSize: 15, fontWeight: '600' },
  });
}
