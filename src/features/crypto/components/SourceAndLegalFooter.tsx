import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import LegalDisclaimer, {
  LegalDisclaimerInfoButton,
  type LegalDisclaimerVariant,
} from '../../../shared/components/LegalDisclaimer';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface Props {
  legalVariant: LegalDisclaimerVariant;
  /** Invest: one line for the active tab. Portfolio: omit to show combined sources. */
  sourceNote?: string;
  stocksEnabled?: boolean;
  earnEnabled?: boolean;
  borrowEnabled?: boolean;
  /** Show full disclaimer inline (default: compact teaser + info button). */
  showFullDisclaimer?: boolean;
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
  legalVariant,
  sourceNote,
  stocksEnabled = false,
  earnEnabled = false,
  borrowEnabled = false,
  showFullDisclaimer = false,
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

      {showFullDisclaimer ? (
        <LegalDisclaimer variant={legalVariant} style={st.legalFull} />
      ) : (
        <View style={st.legalRow}>
          <Text style={st.legalTeaser} numberOfLines={2}>
            {t('legal.footerTeaser')}
          </Text>
          <LegalDisclaimerInfoButton variant={legalVariant} size={16} style={st.infoBtn} />
        </View>
      )}
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
    legalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      maxWidth: '100%',
    },
    legalTeaser: {
      color: c.textFaint,
      fontSize: 10,
      lineHeight: 14,
      textAlign: 'center',
      flexShrink: 1,
      opacity: 0.9,
    },
    infoBtn: {
      marginTop: 1,
    },
    legalFull: {
      marginTop: 0,
    },
  });
}
