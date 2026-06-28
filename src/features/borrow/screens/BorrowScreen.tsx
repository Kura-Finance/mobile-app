/**
 * Borrow tab — hub layout with credit summary, loans, and markets.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  Platform,
  RefreshControl,
} from 'react-native';
import { View as SafeAreaView } from 'react-native';

import { useHeaderHeight } from '../../../shared/navigation/Header';
import { useHeaderStore } from '../../../shared/store/useHeaderStore';
import { useFavoritesStore } from '../../crypto/store/useFavoritesStore';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import BorrowView from './BorrowView';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

function useStyles() {
  const { colors } = useTheme();
  return React.useMemo(() => makeStyles(colors), [colors]);
}

export default function BorrowScreen() {
  const { colors } = useTheme();
  const st = useStyles();
  const headerHeight = useHeaderHeight();
  const setScrolled = useHeaderStore((s) => s.setScrolled);
  const hydrateFavorites = useFavoritesStore((s) => s.hydrate);
  const { smartAddress } = useKuraCardWallet();
  const scaAddress = smartAddress || null;

  useEffect(() => { hydrateFavorites(); }, [hydrateFavorites]);

  const borrowRefreshRef = useRef<(() => void) | null>(null);
  const [borrowRefreshing, setBorrowRefreshing] = useState(false);

  const handleRefresh = () => {
    borrowRefreshRef.current?.();
  };

  return (
    <SafeAreaView style={st.root}>
      <ScrollView
        style={st.outerScroll}
        contentContainerStyle={[st.outerScrollContent, { paddingTop: headerHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={Platform.OS === 'android'}
        scrollEventThrottle={16}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
        refreshControl={
          <RefreshControl
            refreshing={borrowRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <BorrowView
          scaAddress={scaAddress}
          onBindRefresh={(fn) => { borrowRefreshRef.current = fn; }}
          onRefreshingChange={setBorrowRefreshing}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    outerScroll: {
      flex: 1,
    },
    outerScrollContent: {
      paddingBottom: 120,
    },
  });
}
