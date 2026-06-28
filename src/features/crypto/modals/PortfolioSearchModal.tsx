import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import type { AssetClass } from '../components/AssetClassToggle';
import { filterPortfolioByAssetClass } from '../config/portfolioAssetClasses';
import type { PortfolioToken } from '../hooks/usePortfolio';
import type { StockItem } from '../../stocks/hooks/useDinari';
import type { MorphoVault } from '../../../lib/api/morpho/client';
import type { BluechipToken } from '../config/blueChips';
import TokenLogo from '../components/TokenLogo';
import StockLogo from '../../stocks/components/StockLogo';
import VaultLogo from '../../earn/components/VaultLogo';
import { earnFavoriteKey } from '../../earn/utils/earnFavorites';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';
import {
  normalizeSearchQuery,
  matchesToken,
  matchesStock,
  matchesVault,
} from '../utils/portfolioSearch';

interface Props {
  visible: boolean;
  assetClass: AssetClass;
  favoritesOnly?: boolean;
  favoriteSymbols?: string[];
  tokens: PortfolioToken[];
  stocks: StockItem[];
  vaults?: MorphoVault[];
  onClose: () => void;
  onSelectToken: (token: BluechipToken) => void;
  onSelectStock: (stock: StockItem) => void;
  onSelectVault?: (vault: MorphoVault) => void;
}

type SearchResult =
  | { kind: 'crypto'; item: PortfolioToken }
  | { kind: 'stock'; item: StockItem }
  | { kind: 'vault'; item: MorphoVault };

export default function PortfolioSearchModal({
  visible,
  assetClass,
  favoritesOnly = false,
  favoriteSymbols = [],
  tokens,
  stocks,
  vaults = [],
  onClose,
  onSelectToken,
  onSelectStock,
  onSelectVault,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const money = useMoneyFormat();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const [query, setQuery] = useState('');

  const favoriteSet = useMemo(() => new Set(favoriteSymbols), [favoriteSymbols]);

  const results = useMemo(() => {
    const q = normalizeSearchQuery(query);
    const list: SearchResult[] = [];

    if (assetClass === 'stock') {
      for (const item of stocks) {
        if (favoritesOnly && !favoriteSet.has(item.symbol)) continue;
        if (!q || matchesStock(item, q)) list.push({ kind: 'stock', item });
      }
    } else if (assetClass === 'earn') {
      for (const item of vaults) {
        if (favoritesOnly && !favoriteSet.has(earnFavoriteKey(item))) continue;
        if (!q || matchesVault(item, q)) list.push({ kind: 'vault', item });
      }
    } else {
      const scoped = filterPortfolioByAssetClass(tokens, assetClass);
      for (const item of scoped) {
        if (favoritesOnly && !favoriteSet.has(item.token.symbol)) continue;
        if (!q || matchesToken(item, q)) list.push({ kind: 'crypto', item });
      }
    }

    return list;
  }, [assetClass, favoriteSet, favoritesOnly, query, stocks, tokens, vaults]);

  const handleSelect = (result: SearchResult) => {
    setQuery('');
    onClose();
    if (result.kind === 'crypto') {
      onSelectToken(result.item.token);
    } else if (result.kind === 'vault') {
      onSelectVault?.(result.item);
    } else {
      onSelectStock(result.item);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[st.root, { paddingTop: insets.top + 8 }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={st.header}>
          <View style={st.searchBar}>
            <Ionicons name="search" size={18} color={colors.textFaint} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={
                assetClass === 'stock'
                  ? t('crypto.searchStocksPlaceholder')
                  : assetClass === 'stablecoin'
                    ? t('crypto.searchStablecoinPlaceholder')
                    : assetClass === 'earn'
                      ? t('crypto.searchEarnPlaceholder')
                      : t('crypto.searchCryptoPlaceholder')
              }
              placeholderTextColor={colors.textFaint}
              style={st.searchInput}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textFaint} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={8} style={st.cancelBtn}>
            <Text style={st.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => {
            if (item.kind === 'crypto') return item.item.token.symbol;
            if (item.kind === 'vault') return item.item.address;
            return item.item.id;
          }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <View style={st.empty}>
              <Text style={st.emptyText}>{t('crypto.searchNoResults')}</Text>
            </View>
          }
          renderItem={({ item: result }) => {
            if (result.kind === 'crypto') {
              const { token, price } = result.item;
              return (
                <TouchableOpacity
                  style={st.row}
                  onPress={() => handleSelect(result)}
                  activeOpacity={0.7}
                >
                  <TokenLogo token={token} size={40} />
                  <View style={st.mid}>
                    <Text style={st.symbol}>{token.displayName}</Text>
                    <Text style={st.sub}>{token.symbol}</Text>
                  </View>
                  <Text style={st.price}>{price > 0 ? money.price(price) : '—'}</Text>
                </TouchableOpacity>
              );
            }

            if (result.kind === 'vault') {
              const vault = result.item;
              return (
                <TouchableOpacity
                  style={st.row}
                  onPress={() => handleSelect(result)}
                  activeOpacity={0.7}
                >
                  <VaultLogo vault={vault} size={40} />
                  <View style={st.mid}>
                    <Text style={st.symbol} numberOfLines={1}>{vault.name}</Text>
                    <Text style={st.sub}>{vault.asset.symbol}</Text>
                  </View>
                  <Text style={[st.price, st.apy]}>
                    {vault.netApy > 0 ? `${(vault.netApy * 100).toFixed(2)}%` : '—'}
                  </Text>
                </TouchableOpacity>
              );
            }

            const { symbol, name, price } = result.item;
            return (
              <TouchableOpacity
                style={st.row}
                onPress={() => handleSelect(result)}
                activeOpacity={0.7}
              >
                <StockLogo symbol={symbol} size={40} />
                <View style={st.mid}>
                  <Text style={st.symbol}>{symbol}</Text>
                  <Text style={st.sub} numberOfLines={1}>{name}</Text>
                </View>
                <Text style={st.price}>{price > 0 ? money.price(price) : '—'}</Text>
              </TouchableOpacity>
            );
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    searchBar: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: {
      flex: 1,
      color: c.text,
      fontSize: 16,
      padding: 0,
    },
    cancelBtn: {
      paddingHorizontal: 4,
      paddingVertical: 8,
    },
    cancelText: {
      color: c.primary,
      fontSize: 16,
      fontWeight: '600',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    mid: {
      flex: 1,
      gap: 2,
    },
    symbol: {
      color: c.text,
      fontSize: 16,
      fontWeight: '700',
    },
    sub: {
      color: c.textMuted,
      fontSize: 13,
    },
    price: {
      color: c.textMuted,
      fontSize: 14,
      fontWeight: '600',
    },
    apy: {
      color: '#10B981',
    },
    empty: {
      alignItems: 'center',
      paddingTop: 48,
      paddingHorizontal: 24,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 14,
      textAlign: 'center',
    },
  });
}
