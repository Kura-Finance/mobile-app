import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface WalletBalanceRowProps {
  icon: string;
  symbol: string;
  name: string;
  balance: string;
  usdValue: string;
  color: string;
}

export default function WalletBalanceRow({
  icon, symbol, name, balance, usdValue, color,
}: WalletBalanceRowProps) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={s.row}>
      <View style={[s.icon, { backgroundColor: `${color}22` }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.symbol}>{symbol}</Text>
        <Text style={s.name}>{name}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={s.balance}>{balance}</Text>
        <Text style={s.usd}>{usdValue}</Text>
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row', alignItems: 'center', padding: 16,
      borderBottomWidth: 1, borderBottomColor: c.border,
    },
    icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    symbol: { color: c.text, fontSize: 14, fontWeight: '600' },
    name: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    balance: { color: c.text, fontSize: 14, fontWeight: '600' },
    usd: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  });
}
