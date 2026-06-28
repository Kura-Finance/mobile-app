import React, { useMemo } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import AssetClassToggle, { type AssetClass } from './AssetClassToggle';
import { makePortfolioToolbarBtnStyles, PORTFOLIO_TOOLBAR_BTN } from './portfolioToolbarStyles';
import { useTheme } from '../../../shared/theme/ThemeContext';

interface Props {
  assetClass: AssetClass;
  onChangeAssetClass: (v: AssetClass) => void;
  stocksEnabled?: boolean;
  earnEnabled?: boolean;
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (value: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
}

export default function PortfolioToolbar({
  assetClass,
  onChangeAssetClass,
  stocksEnabled = true,
  earnEnabled = true,
  favoritesOnly,
  onFavoritesOnlyChange,
  searchQuery,
  onSearchQueryChange,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const btn = useMemo(() => makePortfolioToolbarBtnStyles(colors), [colors]);

  const searchPlaceholder = useMemo(() => {
    switch (assetClass) {
      case 'stock':
        return t('crypto.searchStocksPlaceholder');
      case 'earn':
        return t('crypto.searchEarnPlaceholder');
      case 'stablecoin':
        return t('crypto.searchStablecoinPlaceholder');
      default:
        return t('crypto.searchCryptoPlaceholder');
    }
  }, [assetClass, t]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.searchBar, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          placeholder={searchPlaceholder}
          placeholderTextColor={colors.textFaint}
          style={[styles.searchInput, { color: colors.text }]}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="never"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => onSearchQueryChange('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.row}>
        <TouchableOpacity
          style={[
            btn.btn,
            styles.favoritesBtn,
            favoritesOnly && btn.btnActive,
          ]}
          onPress={() => onFavoritesOnlyChange(!favoritesOnly)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={t('crypto.favorites')}
          accessibilityState={{ selected: favoritesOnly }}
        >
          <Ionicons
            name={favoritesOnly ? 'star' : 'star-outline'}
            size={18}
            color={favoritesOnly ? '#FFFFFF' : colors.text}
          />
        </TouchableOpacity>

        <View style={styles.tabsHost}>
          <AssetClassToggle
            value={assetClass}
            onChange={onChangeAssetClass}
            stocksEnabled={stocksEnabled}
            earnEnabled={earnEnabled}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tabsHost: {
    flex: 1,
    minWidth: 0,
  },
  favoritesBtn: {
    width: PORTFOLIO_TOOLBAR_BTN.height,
  },
});
