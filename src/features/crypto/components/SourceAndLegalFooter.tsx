import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface Props {
  /** Invest: one line for the active tab. Portfolio: omit to show combined sources. */
  sourceNote?: string;
  stocksEnabled?: boolean;
  earnEnabled?: boolean;
  borrowEnabled?: boolean;
}

function buildSourceLines(
  t: (key: string) => string,
  options: Pick<Props, 'sourceNote' | 'stocksEnabled' | 'earnEnabled' | 'borrowEnabled'>,
): string[] {
  if (options.sourceNote) return [options.sourceNote];

  const lines = [t('crypto.footerSourcePrices')];
  if (options.stocksEnabled) lines.push(t('crypto.footerSourceStocks'));
  if (options.earnEnabled) lines.push(t('crypto.footerSourceEarn'));
  if (options.borrowEnabled) lines.push(t('crypto.footerSourceBorrow'));
  return lines;
}

export default function SourceAndLegalFooter({
  sourceNote,
  stocksEnabled = false,
  earnEnabled = false,
  borrowEnabled = false,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const sourceLines = useMemo(
    () => buildSourceLines(t, { sourceNote, stocksEnabled, earnEnabled, borrowEnabled }),
    [t, sourceNote, stocksEnabled, earnEnabled, borrowEnabled],
  );

  return (
    <View style={st.root}>
      <View style={st.sourcesBlock}>
        {sourceLines.map((line) => (
          <Text key={line} style={st.sourceLine}>
            {line}
          </Text>
        ))}
      </View>
      <Text style={st.legalTeaser} numberOfLines={2}>
        {t('legal.footerTeaser')}
      </Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingTop: 12,
      gap: 8,
    },
    sourcesBlock: {
      alignItems: 'center',
      gap: 2,
    },
    sourceLine: {
      color: c.textFaint,
      fontSize: 10,
      lineHeight: 14,
      textAlign: 'center',
      letterSpacing: 0.1,
    },
    legalTeaser: {
      color: c.textFaint,
      fontSize: 10,
      lineHeight: 14,
      textAlign: 'center',
      flexShrink: 1,
      opacity: 0.9,
    },
  });
}
