import LoadingDots from '../../../../shared/components/LoadingDots';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import WalletTxRow from './WalletTxRow';
import { useWalletHistory, type WalletTx } from '../../hooks/useWalletHistory';
import { useCryptoContacts } from '../../hooks/useCryptoContacts';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';

const HOME_PREVIEW_LIMIT = 3;
/** Max extra pages to fetch on Home when the first page(s) are mostly dust. */
const HOME_PREFETCH_MAX_PAGES = 5;

interface WalletHistorySectionProps {
  smartAddress: string;
  sectionTitleStyle: object;
  /** When set, only show this many rows and a "View all" link instead of load-more. */
  previewLimit?: number;
  onViewAll?: () => void;
  onTxPress?: (tx: WalletTx) => void;
}

export default function WalletHistorySection({
  smartAddress,
  sectionTitleStyle,
  previewLimit,
  onViewAll,
  onTxPress,
}: WalletHistorySectionProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { txs, loading, error, hasMore, loadMore, refresh } = useWalletHistory(smartAddress);
  const { contacts, revision } = useCryptoContacts();
  const prefetchPagesRef = useRef(0);
  const prevContactsRevision = useRef(revision);

  const isPreview = previewLimit != null;
  const visibleTxs = isPreview ? txs.slice(0, previewLimit) : txs;
  const showViewAll = isPreview && onViewAll && (txs.length > previewLimit || hasMore);

  useEffect(() => {
    prefetchPagesRef.current = 0;
  }, [smartAddress]);

  useEffect(() => {
    if (prevContactsRevision.current === revision) return;
    prevContactsRevision.current = revision;
    if (revision === 0) return;
    refresh();
  }, [revision, refresh]);

  useEffect(() => {
    if (!isPreview || previewLimit == null) return;
    if (loading || !hasMore) return;
    if (txs.length >= previewLimit) {
      prefetchPagesRef.current = 0;
      return;
    }
    if (prefetchPagesRef.current >= HOME_PREFETCH_MAX_PAGES) return;
    prefetchPagesRef.current += 1;
    loadMore();
  }, [isPreview, previewLimit, txs.length, loading, hasMore, loadMore]);

  return (
    <>
      <Text style={[sectionTitleStyle, s.sectionTitle]}>{t('card.history')}</Text>

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
          <WalletTxRow key={tx.id} tx={tx} contacts={contacts} onPress={onTxPress} />
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
            <LoadingDots compact color={colors.textMuted} size={6}    />
          </View>
        )}
      </View>
    </>
  );
}

export { HOME_PREVIEW_LIMIT };

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    sectionTitle: { marginBottom: 14 },
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
