import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

interface Props {
  style?: StyleProp<ViewStyle>;
}

export default function TrackFiLegalFooter({ style }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[st.wrap, style]}>
      <Text style={st.teaser}>{t('trackfi.footerTeaser')}</Text>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      marginTop: 24,
      marginBottom: 4,
      alignItems: 'center',
    },
    teaser: {
      color: c.textFaint,
      fontSize: 10,
      lineHeight: 14,
      textAlign: 'center',
      opacity: 0.9,
    },
  });
}
