import React, { useMemo } from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/theme';
import { formatDisplayError } from '../../lib/wallet/userFacingTransactionError';

interface Props {
  message: string;
  title?: string;
  style?: StyleProp<ViewStyle>;
}

export default function InlineErrorBanner({ message, title, style }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const displayMessage = useMemo(() => formatDisplayError(message), [message]);

  return (
    <View style={[st.box, style]} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={16} color={colors.danger} style={st.icon} />
      <View style={st.textWrap}>
        {title ? <Text style={st.title}>{title}</Text> : null}
        <Text style={st.message} numberOfLines={5} ellipsizeMode="tail">
          {displayMessage}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    box: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.2)',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    icon: { marginTop: 1 },
    textWrap: { flex: 1, gap: 4 },
    title: { color: c.danger, fontSize: 13, fontWeight: '700' },
    message: { color: c.danger, fontSize: 12, lineHeight: 18 },
  });
}
