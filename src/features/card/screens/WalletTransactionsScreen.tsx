import LoadingDots from '../../../shared/components/LoadingDots';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import WalletTxRow from '../components/wallet/WalletTxRow';
import { useWalletHistory, type WalletTx, DEFAULT_TX_HISTORY_WINDOW_DAYS } from '../hooks/useWalletHistory';
import { useCryptoContacts } from '../hooks/useCryptoContacts';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';

type RouteParams = {
  WalletTransactions: { smartAddress: string };
};

export default function WalletTransactionsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RouteParams, 'WalletTransactions'>>();
  const smartAddress = route.params?.smartAddress ?? '';
  const { txs, loading, error, hasMore, initialWindowLoading, loadMore, refresh } = useWalletHistory(
    smartAddress,
    { initialWindowDays: DEFAULT_TX_HISTORY_WINDOW_DAYS },
  );
  const { contacts, revision } = useCryptoContacts();
  const [refreshing, setRefreshing] = useState(false);
  const prevContactsRevision = useRef(revision);

  // Reload last month's txs whenever this screen is opened.
  useFocusEffect(
    useCallback(() => {
      if (!smartAddress) return;
      refresh();
    }, [smartAddress, refresh]),
  );

  // Refresh list when address book changes (save / delete).
  useEffect(() => {
    if (prevContactsRevision.current === revision) return;
    prevContactsRevision.current = revision;
    if (revision === 0 || !smartAddress) return;
    refresh();
  }, [revision, smartAddress, refresh]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!refreshing || loading || initialWindowLoading) return;
    setRefreshing(false);
  }, [refreshing, loading, initialWindowLoading]);

  const openExplorer = useCallback(() => {
    if (!smartAddress) return;
    Linking.openURL(
      `https://base.blockscout.com/address/${smartAddress}?tab=token_transfers`,
    ).catch(() => undefined);
  }, [smartAddress]);

  const openTxDetail = useCallback((tx: WalletTx) => {
    navigation.navigate('TransactionDetail', { tx, smartAddress });
  }, [navigation, smartAddress]);

  const renderFooter = () => {
    if (loading && txs.length > 0) {
      return (
        <View style={s.footerSpinner}>
          <LoadingDots compact color={colors.textMuted} size={6}    />
        </View>
      );
    }
    if (hasMore && !loading && !initialWindowLoading) {
      return (
        <TouchableOpacity onPress={loadMore} style={s.loadMoreBtn} activeOpacity={0.7}>
          <Text style={s.loadMoreText}>{t('card.loadMore')}</Text>
        </TouchableOpacity>
      );
    }
    return null;
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.screenTitle}>{t('card.allTransactions')}</Text>
        <TouchableOpacity onPress={openExplorer} style={s.backBtn} hitSlop={8}>
          <Ionicons name="open-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={txs}
        keyExtractor={(tx) => tx.id}
        renderItem={({ item }) => (
          <WalletTxRow tx={item} contacts={contacts} onPress={openTxDetail} />
        )}
        contentContainerStyle={[
          s.listContent,
          { paddingBottom: insets.bottom + 24 },
          txs.length === 0 && s.listEmpty,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        onEndReached={() => {
          if (hasMore && !loading && !initialWindowLoading) loadMore();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          !loading && !error ? (
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={32} color={colors.textFaint} />
              <Text style={s.emptyText}>{t('card.noTransactionsYet')}</Text>
            </View>
          ) : null
        }
        ListHeaderComponent={
          error ? (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
              <Text style={s.errorText}>{error}</Text>
            </View>
          ) : null
        }
      />

      {loading && txs.length === 0 && (
        <View style={s.initialLoading}>
          <LoadingDots color={colors.primary} size={10}    />
        </View>
      )}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    screenTitle: { color: c.text, fontSize: 17, fontWeight: '700' },
    listContent: { paddingHorizontal: 16, paddingTop: 8 },
    listEmpty: { flexGrow: 1 },
    empty: { alignItems: 'center', paddingVertical: 48, gap: 12 },
    emptyText: { color: c.textFaint, fontSize: 14 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
      padding: 12,
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.2)',
    },
    errorText: { color: c.danger, fontSize: 13, flex: 1 },
    loadMoreBtn: { alignItems: 'center', paddingVertical: 16 },
    loadMoreText: { color: c.primary, fontSize: 14, fontWeight: '600' },
    footerSpinner: { paddingVertical: 16, alignItems: 'center' },
    initialLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
