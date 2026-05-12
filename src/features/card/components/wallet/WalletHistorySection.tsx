import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import WalletTxRow from './WalletTxRow';
import { useWalletHistory } from '../../hooks/useWalletHistory';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

const HOME_PREVIEW_LIMIT = 3;

interface WalletHistorySectionProps {
  smartAddress: string;
  sectionTitleStyle: object;
  /** When set, only show this many rows and a "View all" link instead of load-more. */
  previewLimit?: number;
  onViewAll?: () => void;
}

export default function WalletHistorySection({
  smartAddress,
  sectionTitleStyle,
  previewLimit,
  onViewAll,
}: WalletHistorySectionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { txs, loading, error, hasMore, loadMore } = useWalletHistory(smartAddress);

  const isPreview = previewLimit != null;
  const visibleTxs = isPreview ? txs.slice(0, previewLimit) : txs;
  const showViewAll = isPreview && onViewAll && (txs.length > previewLimit || hasMore);

  const openAllTxs = useCallback(() => {
    Linking.openURL(
      `https://base.blockscout.com/address/${smartAddress}?tab=token_transfers`,
    ).catch(() => undefined);
  }, [smartAddress]);

  return (
    <>
      <View style={s.headerRow}>
        <Text style={sectionTitleStyle}>{t('card.history')}</Text>
        <TouchableOpacity onPress={openAllTxs} style={s.explorerBtn} activeOpacity={0.7}>
          <Ionicons name="open-outline" size={12} color={colors.textMuted} />
          <Text style={s.explorerText}>Blockscout</Text>
        </TouchableOpacity>
      </View>

      <View style={s.card}>
        {!loading && !error && txs.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="receipt-outline" size={28} color={colors.textFaint} style={{ marginBottom: 8 }} />
            <Text style={s.emptyText}>{t('card.noTransactionsYet')}</Text>
          </View>
        )}

        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {visibleTxs.map((tx) => (
          <WalletTxRow key={tx.id} tx={tx} />
        ))}

        {showViewAll && (
          <TouchableOpacity onPress={onViewAll} style={s.viewAllBtn} activeOpacity={0.7}>
            <Text style={s.viewAllText}>{t('card.viewAll')}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        )}

        {!isPreview && hasMore && !loading && (
          <TouchableOpacity onPress={loadMore} style={s.loadMoreBtn} activeOpacity={0.7}>
            <Text style={s.loadMoreText}>{t('card.loadMore')}</Text>
          </TouchableOpacity>
        )}

        {loading && txs.length === 0 && (
          <View style={s.loadingWrap}>
            {[1, 2, 3].map((i) => (
              <View key={i} style={s.skeletonRow}>
                <View style={s.skeletonIcon} />
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={[s.skeletonBar, { width: '40%' }]} />
                  <View style={[s.skeletonBar, { width: '60%', height: 10 }]} />
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <View style={[s.skeletonBar, { width: 70 }]} />
                  <View style={[s.skeletonBar, { width: 40, height: 10 }]} />
                </View>
              </View>
            ))}
          </View>
        )}

        {loading && txs.length > 0 && !isPreview && (
          <View style={s.loadMoreSpinner}>
            <ActivityIndicator size="small" color={colors.textMuted} />
          </View>
        )}
      </View>
    </>
  );
}

export { HOME_PREVIEW_LIMIT };

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    explorerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.surface,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    explorerText: { color: c.textMuted, fontSize: 11, fontWeight: '500' },
    card: {
      backgroundColor: c.surface,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 20,
      borderWidth: 1,
      borderColor: c.primarySoft,
    },
    empty: { alignItems: 'center', paddingVertical: 28 },
    emptyText: { color: c.textFaint, fontSize: 13 },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      margin: 14,
      padding: 10,
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderRadius: 10,
    },
    errorText: { color: c.danger, fontSize: 12, flex: 1 },
    viewAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: 14,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    viewAllText: { color: c.primary, fontSize: 14, fontWeight: '600' },
    loadMoreBtn: {
      alignItems: 'center',
      paddingVertical: 13,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    loadMoreText: { color: c.primary, fontSize: 13, fontWeight: '600' },
    loadMoreSpinner: { paddingVertical: 14, alignItems: 'center' },
    loadingWrap: { gap: 0 },
    skeletonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 14,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    skeletonIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: c.surfaceInput },
    skeletonBar: { height: 12, borderRadius: 6, backgroundColor: c.surfaceInput, width: '100%' },
  });
}
