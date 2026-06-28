import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { investListScrollHeight } from './investListMetrics';

interface Props {
  leftLabel: string;
  rightLabel: string;
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  onScroll?: (offsetY: number) => void;
  /** When set, the card shows this many rows before the inner list scrolls. */
  maxVisibleRows?: number;
  /** List expands in a parent ScrollView instead of nesting (fixes Android). */
  outerScroll?: boolean;
  onRightPress?: () => void;
  sortActive?: boolean;
}

export default function InvestListCard({
  leftLabel,
  rightLabel,
  children,
  refreshing = false,
  onRefresh,
  onScroll,
  maxVisibleRows,
  outerScroll = false,
  onRightPress,
  sortActive = false,
}: Props) {
  const { colors } = useTheme();
  const st = useMemo(
    () => makeStyles(colors, maxVisibleRows, outerScroll),
    [colors, maxVisibleRows, outerScroll],
  );

  return (
    <View style={st.host}>
      <View style={st.card}>
        <View style={st.colHeader}>
          <Text style={st.colLabel}>{leftLabel}</Text>
          {onRightPress ? (
            <TouchableOpacity
              style={st.colRightBtn}
              onPress={onRightPress}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={[st.colLabel, st.colLabelRight, sortActive && st.colLabelActive]}>
                {rightLabel}
              </Text>
              <Ionicons
                name="swap-vertical"
                size={14}
                color={sortActive ? colors.primary : colors.textFaint}
              />
            </TouchableOpacity>
          ) : (
            <Text style={[st.colLabel, st.colLabelRight]}>{rightLabel}</Text>
          )}
        </View>
        {outerScroll ? (
          <View style={st.body} collapsable={false}>{children}</View>
        ) : (
          <ScrollView
            style={st.scroll}
            contentContainerStyle={st.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled={Platform.OS === 'android'}
            scrollEventThrottle={16}
            onScroll={onScroll ? (e) => onScroll(e.nativeEvent.contentOffset.y) : undefined}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function makeStyles(c: ThemeColors, maxVisibleRows?: number, outerScroll = false) {
  const scrollHeight =
    !outerScroll && maxVisibleRows != null
      ? investListScrollHeight(maxVisibleRows)
      : undefined;

  return StyleSheet.create({
    host: {
      ...(scrollHeight == null && !outerScroll ? { flex: 1, minHeight: 0 } : {}),
      marginHorizontal: 16,
      ...(outerScroll ? { pointerEvents: 'box-none' as const } : {}),
    },
    card: {
      ...(scrollHeight == null && !outerScroll ? { flex: 1 } : {}),
      backgroundColor: c.surfaceAlt,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    colHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    colLabel: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    colLabelRight: {
      textAlign: 'right',
    },
    colLabelActive: {
      color: c.primary,
    },
    colRightBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    body: {},
    scroll: scrollHeight != null ? { maxHeight: scrollHeight } : { flex: 1 },
    scrollContent: {
      flexGrow: scrollHeight != null ? 0 : 1,
    },
  });
}
