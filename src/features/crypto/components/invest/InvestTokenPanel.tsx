import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { AssetClass } from '../AssetClassToggle';
import { filterPortfolioByAssetClass } from '../../config/portfolioAssetClasses';
import type { PortfolioToken } from '../../hooks/usePortfolio';
import type { BluechipToken } from '../../config/blueChips';
import { useFavoritesStore } from '../../store/useFavoritesStore';
import { matchesToken, normalizeSearchQuery } from '../../utils/portfolioSearch';
import { sortPortfolioTokens, type InvestSortKey } from '../../utils/investSort';
import PortfolioTokenRow from '../PortfolioTokenRow';
import InvestListCard from './InvestListCard';
import InvestSortSheet from './InvestSortSheet';
import InvestEmbeddedFlatList from './InvestEmbeddedFlatList';
import LoadingDots from '../../../../shared/components/LoadingDots';

const SORT_HEADER_I18N: Record<InvestSortKey, string> = {
  price: 'crypto.sortPrice',
  marketCap: 'crypto.sortMarketCap',
  gainers: 'crypto.sortGainers',
  losers: 'crypto.sortLosers',
};

interface Props {
  assetClass: Extract<AssetClass, 'stablecoin' | 'crypto'>;
  tokens: PortfolioToken[];
  favoritesOnly: boolean;
  searchQuery?: string;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onScroll?: (offsetY: number) => void;
  onPressToken: (token: BluechipToken) => void;
}

export default function InvestTokenPanel({
  assetClass,
  tokens,
  favoritesOnly,
  searchQuery = '',
  loading = false,
  refreshing = false,
  onRefresh,
  onScroll,
  onPressToken,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const favorites = useFavoritesStore((s) => s.favorites);
  const query = normalizeSearchQuery(searchQuery);
  const isSearching = query.length > 0;
  const [sortKey, setSortKey] = useState<InvestSortKey>('price');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  useEffect(() => {
    setSortKey('price');
  }, [assetClass]);

  const portfolioTokens = useMemo(
    () => filterPortfolioByAssetClass(tokens, assetClass),
    [tokens, assetClass],
  );

  const sortedTokens = useMemo(
    () => sortPortfolioTokens(portfolioTokens, sortKey),
    [portfolioTokens, sortKey],
  );

  const favoriteTokens = useMemo(
    () => sortedTokens.filter((item) => favorites.includes(item.token.symbol)),
    [sortedTokens, favorites],
  );

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const pool = favoritesOnly ? favoriteTokens : sortedTokens;
    return pool.filter((item) => matchesToken(item, query));
  }, [favoriteTokens, favoritesOnly, isSearching, sortedTokens, query]);

  const displayItems = useMemo(() => {
    if (isSearching) return searchResults;
    if (favoritesOnly) return favoriteTokens;
    return sortedTokens;
  }, [favoriteTokens, favoritesOnly, isSearching, searchResults, sortedTokens]);

  const showEmpty = displayItems.length === 0 && (isSearching || favoritesOnly);
  const emptyMessage = isSearching
    ? t('crypto.searchNoResults')
    : t('crypto.favoritesEmpty');

  const listContent = loading && portfolioTokens.length === 0 ? (
    <View style={styles.loadingRow}>
      <LoadingDots color={colors.textMuted} size={8} />
    </View>
  ) : showEmpty ? (
    <View style={styles.empty}>
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        {emptyMessage}
      </Text>
    </View>
  ) : (
    <InvestEmbeddedFlatList
      data={displayItems}
      keyExtractor={(item) => item.token.symbol}
      renderItem={({ item }) => (
        <PortfolioTokenRow
          item={item}
          layout="invest"
          onPress={onPressToken}
        />
      )}
    />
  );

  return (
    <>
      <InvestListCard
        leftLabel={t('crypto.colAsset')}
        rightLabel={t(SORT_HEADER_I18N[sortKey])}
        sortActive={sortKey !== 'price'}
        onRightPress={() => setSortSheetOpen(true)}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onScroll={onScroll}
        outerScroll
      >
        {listContent}
      </InvestListCard>
      <InvestSortSheet
        visible={sortSheetOpen}
        selected={sortKey}
        onSelect={setSortKey}
        onClose={() => setSortSheetOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
