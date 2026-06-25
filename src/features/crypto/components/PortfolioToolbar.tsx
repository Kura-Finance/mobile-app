import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
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
  onSearchPress: () => void;
}

export default function PortfolioToolbar({
  assetClass,
  onChangeAssetClass,
  stocksEnabled = true,
  earnEnabled = true,
  favoritesOnly,
  onFavoritesOnlyChange,
  onSearchPress,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const btn = useMemo(() => makePortfolioToolbarBtnStyles(colors), [colors]);

  const favoritesEnabled = assetClass !== 'earn';

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[
          btn.btn,
          styles.favoritesBtn,
          favoritesEnabled && favoritesOnly && btn.btnActive,
          !favoritesEnabled && styles.favoritesBtnDisabled,
        ]}
        onPress={() => {
          if (favoritesEnabled) onFavoritesOnlyChange(!favoritesOnly);
        }}
        activeOpacity={favoritesEnabled ? 0.75 : 1}
        disabled={!favoritesEnabled}
        accessibilityRole="button"
        accessibilityLabel={t('crypto.favorites')}
        accessibilityState={{ selected: favoritesEnabled && favoritesOnly, disabled: !favoritesEnabled }}
      >
        <Ionicons
          name={favoritesEnabled && favoritesOnly ? 'star' : 'star-outline'}
          size={18}
          color={
            !favoritesEnabled
              ? colors.textFaint
              : favoritesOnly
                ? '#FFFFFF'
                : colors.text
          }
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

      <TouchableOpacity
        style={[btn.btn, styles.searchBtn]}
        onPress={onSearchPress}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={t('crypto.search')}
      >
        <Ionicons name="search" size={18} color={colors.text} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  tabsHost: {
    flex: 1,
    minWidth: 0,
  },
  favoritesBtn: {
    width: PORTFOLIO_TOOLBAR_BTN.height,
  },
  favoritesBtnDisabled: {
    opacity: 0.45,
  },
  searchBtn: {
    width: PORTFOLIO_TOOLBAR_BTN.height,
  },
});
