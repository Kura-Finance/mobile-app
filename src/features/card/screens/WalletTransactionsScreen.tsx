import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import WalletTxRow from '../components/wallet/WalletTxRow';
import { useWalletHistory, type WalletTx } from '../hooks/useWalletHistory';
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
  const { txs, loading, error, hasMore, loadMore, refresh } = useWalletHistory(smartAddress);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

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
          <ActivityIndicator size="small" color={colors.textMuted} />
        </View>
      );
    }
    if (hasMore && !loading) {
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
        renderItem={({ item }) => <WalletTxRow tx={item} onPress={openTxDetail} />}
        contentContainerStyle={[
          s.listContent,
          { paddingBottom: insets.bottom + 24 },
          txs.length === 0 && s.listEmpty,
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
        onEndReached={() => {
          if (hasMore && !loading) loadMore();
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
          <ActivityIndicator size="large" color={colors.primary} />
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
