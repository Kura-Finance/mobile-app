import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

/** Numbered two-column grid of recovery-phrase words. */
export default function RecoveryPhraseGrid({ phrase }: { phrase: string }) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const words = phrase.trim().split(/\s+/);

  return (
    <View style={s.grid} accessibilityLabel={`${words.length} words`}>
      {words.map((word, index) => (
        <View key={`${index}-${word}`} style={s.cell}>
          <Text style={s.index}>{index + 1}</Text>
          <Text style={s.word} selectable={false}>
            {word}
          </Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
    cell: {
      width: '48.5%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 12,
      paddingHorizontal: 12,
    },
    index: { width: 20, color: c.textFaint, fontSize: 13, textAlign: 'right' },
    word: { flex: 1, color: c.text, fontSize: 16, fontWeight: '600' },
  });
}
