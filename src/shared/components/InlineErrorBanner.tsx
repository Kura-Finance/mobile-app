import React, { useCallback, useMemo } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import type { ThemeColors } from '../theme/theme';
import { formatDisplayError } from '../../lib/wallet/userFacingTransactionError';

interface Props {
  message: string;
  title?: string;
  /** When set, tapping the banner opens an explanation alert. */
  hint?: string;
  hintTitle?: string;
  style?: StyleProp<ViewStyle>;
}

export default function InlineErrorBanner({ message, title, hint, hintTitle, style }: Props) {
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const displayMessage = useMemo(() => formatDisplayError(message), [message]);

  const showHint = useCallback(() => {
    if (!hint) return;
    Alert.alert(hintTitle ?? title ?? displayMessage, hint);
  }, [displayMessage, hint, hintTitle, title]);

  const body = (
    <>
      <Ionicons name="alert-circle-outline" size={16} color={colors.danger} style={st.icon} />
      <View style={st.textWrap}>
        {title ? <Text style={st.title}>{title}</Text> : null}
        <Text style={st.message} numberOfLines={5} ellipsizeMode="tail">
          {displayMessage}
        </Text>
      </View>
      {hint ? (
        <Ionicons name="information-circle-outline" size={16} color={colors.textFaint} style={st.hintIcon} />
      ) : null}
    </>
  );

  if (hint) {
    return (
      <TouchableOpacity
        style={[st.box, style]}
        onPress={showHint}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={displayMessage}
        accessibilityHint={hint}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[st.box, style]} accessibilityRole="alert">
      {body}
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
    hintIcon: { marginTop: 1 },
    textWrap: { flex: 1, gap: 4 },
    title: { color: c.danger, fontSize: 13, fontWeight: '700' },
    message: { color: c.danger, fontSize: 12, lineHeight: 18 },
  });
}
