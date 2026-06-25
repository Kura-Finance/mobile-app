import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import { useFavoritesStore } from '../../crypto/store/useFavoritesStore';
import type { StockItem } from '../hooks/useDinari';
import StockLogo from './StockLogo';

export function formatStockHoldings(n: number, symbol: string): string {
  if (n === 0) return `0 ${symbol}`;
  if (n < 0.001) return `${n.toExponential(2)} ${symbol}`;
  if (n < 1) return `${n.toFixed(4)} ${symbol}`;
  if (n < 1000) return `${n.toFixed(2)} ${symbol}`;
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${symbol}`;
}

interface Props {
  item: StockItem;
  onPress: (stock: StockItem) => void;
  showFavorite?: boolean;
}

export default function PortfolioStockRow({ item, onPress, showFavorite = false }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const money = useMoneyFormat();
  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const hasHoldings = item.holdings > 0;
  const isFav = favorites.includes(item.symbol);

  return (
    <TouchableOpacity style={st.row} onPress={() => onPress(item)} activeOpacity={0.65}>
      <StockLogo symbol={item.symbol} size={44} />
      <View style={st.mid}>
        <View style={st.nameRow}>
          <Text style={st.symbol}>{item.symbol}</Text>
        </View>
        <Text style={st.price}>{item.price > 0 ? money.price(item.price) : '—'}</Text>
      </View>
      <View style={st.right}>
        {hasHoldings ? (
          <>
            <Text style={st.value}>{money.compact(item.value)}</Text>
            <Text style={st.holdings}>{formatStockHoldings(item.holdings, item.symbol)}</Text>
          </>
        ) : (
          <Text style={st.noHoldings}>—</Text>
        )}
      </View>
      {showFavorite && (
        <TouchableOpacity
          style={st.starBtn}
          onPress={() => toggleFavorite(item.symbol)}
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
    mid: { flex: 1, gap: 4 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    symbol: { color: c.text, fontSize: 15, fontWeight: '700' },
    price: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
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
