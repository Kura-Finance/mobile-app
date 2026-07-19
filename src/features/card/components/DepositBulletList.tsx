import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface DepositBulletListProps {
  items: (string | null | undefined)[];
}

export default function DepositBulletList({ items }: DepositBulletListProps) {
  const { colors } = useTheme();
  const lines = items.filter((line): line is string => Boolean(line?.trim()));
  if (lines.length === 0) return null;

  const s = makeStyles(colors);
  return (
    <View style={s.list}>
      {lines.map((line, index) => (
        <View key={`${index}-${line.slice(0, 12)}`} style={s.row}>
          <Text style={s.dot}>•</Text>
          <Text style={s.text}>{line}</Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    list: { marginTop: 12, marginBottom: 16, paddingHorizontal: 4, gap: 6 },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    dot: { color: c.textMuted, fontSize: 12, lineHeight: 18, width: 10 },
    text: { flex: 1, color: c.textMuted, fontSize: 12, lineHeight: 18 },
  });
}
