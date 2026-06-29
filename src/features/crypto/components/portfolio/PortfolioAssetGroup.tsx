import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import type { PortfolioDisplayGroup } from '../../config/portfolioAssetClasses';
import { shouldShowPortfolioToken, shouldShowEarnVault, shouldShowPortfolioStock } from '../../config/portfolioAssetClasses';
import PortfolioTokenRow from '../PortfolioTokenRow';
import PortfolioEarnRow from './PortfolioEarnRow';
import PortfolioStockRow from '../../../stocks/components/PortfolioStockRow';
import type { PortfolioToken } from '../../hooks/usePortfolio';
import type { BluechipToken } from '../../config/blueChips';
import type { StockItem } from '../../../stocks/hooks/useDinari';
import type { MorphoVault, MorphoVaultPosition } from '../../../../lib/api/morpho/client';

const GROUP_ICONS: Record<PortfolioDisplayGroup, keyof typeof Ionicons.glyphMap> = {
  cash: 'wallet-outline',
  crypto: 'diamond-outline',
  earn: 'trending-up-outline',
  stocks: 'bar-chart-outline',
};

interface Props {
  group: PortfolioDisplayGroup;
  tokens?: PortfolioToken[];
  vaults?: MorphoVault[];
  positionsByVault?: Record<string, MorphoVaultPosition>;
  stocks?: StockItem[];
  groupTotalOverride?: number;
  portfolioTotal: number;
  hideSmallBalances: boolean;
  defaultExpanded?: boolean;
  onPressToken: (token: BluechipToken) => void;
  onPressVault?: (vault: MorphoVault) => void;
  onPressStock?: (stock: StockItem) => void;
}

export default function PortfolioAssetGroup({
  group,
  tokens = [],
  vaults = [],
  positionsByVault = {},
  stocks = [],
  groupTotalOverride,
  portfolioTotal,
  hideSmallBalances,
  defaultExpanded = true,
  onPressToken,
  onPressVault,
  onPressStock,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const money = useMoneyFormat();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const labelKeys: Record<PortfolioDisplayGroup, string> = {
    cash: 'crypto.portfolioGroupCash',
    crypto: 'crypto.portfolioGroupCrypto',
    earn: 'crypto.portfolioGroupEarn',
    stocks: 'crypto.portfolioGroupStocks',
  };

  const visibleTokens = useMemo(() => {
    if (group === 'stocks' || group === 'earn') return [];
    return tokens.filter((item) => shouldShowPortfolioToken(item, group, hideSmallBalances));
  }, [tokens, group, hideSmallBalances]);

  const visibleVaults = useMemo(() => {
    if (group !== 'earn') return [];
    return vaults.filter((vault) => {
      const depositedUsd = positionsByVault[vault.address.toLowerCase()]?.assetsUsd ?? 0;
      return shouldShowEarnVault(depositedUsd, hideSmallBalances);
    });
  }, [group, vaults, positionsByVault, hideSmallBalances]);

  const visibleStocks = useMemo(() => {
    if (group !== 'stocks') return [];
    return stocks.filter((item) => shouldShowPortfolioStock(item, hideSmallBalances));
  }, [stocks, group, hideSmallBalances]);

  const groupTotal = useMemo(() => {
    if (groupTotalOverride != null) return groupTotalOverride;
    const tokenTotal = visibleTokens.reduce((sum, item) => sum + item.value, 0);
    const vaultTotal = visibleVaults.reduce((sum, vault) => {
      return sum + (positionsByVault[vault.address.toLowerCase()]?.assetsUsd ?? 0);
    }, 0);
    const stockTotal = visibleStocks.reduce((sum, item) => sum + item.value, 0);
    return tokenTotal + vaultTotal + stockTotal;
  }, [visibleTokens, visibleVaults, visibleStocks, positionsByVault, groupTotalOverride]);

  const groupPct = portfolioTotal > 0 ? (groupTotal / portfolioTotal) * 100 : 0;
  const itemCount = visibleTokens.length + visibleVaults.length + visibleStocks.length;
  if (itemCount === 0) return null;

  return (
    <View style={st.card}>
      <TouchableOpacity
        style={st.header}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.7}
      >
        <View style={st.headerLeft}>
          <View style={st.iconWrap}>
            <Ionicons name={GROUP_ICONS[group]} size={18} color={colors.primary} />
          </View>
          <Text style={st.groupName}>{t(labelKeys[group])}</Text>
        </View>
        <View style={st.headerRight}>
          <Text style={st.groupValue}>{money.compact(groupTotal)}</Text>
          <Text style={st.groupPct}>{groupPct.toFixed(2)}%</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textFaint}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={st.body}>
          {visibleTokens.map((item) => (
            <PortfolioTokenRow
              key={item.token.symbol}
              item={item}
              onPress={onPressToken}
              showFavorite={false}
              dimUnheld={false}
              showNetworkBadge
            />
          ))}
          {visibleVaults.map((vault) => (
            <PortfolioEarnRow
              key={vault.address}
              vault={vault}
              depositedUsd={positionsByVault[vault.address.toLowerCase()]?.assetsUsd ?? 0}
              onPress={onPressVault ?? (() => {})}
            />
          ))}
          {visibleStocks.map((item) => (
            <PortfolioStockRow
              key={item.id}
              item={item}
              onPress={onPressStock ?? (() => {})}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      marginHorizontal: 20,
      marginBottom: 12,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flex: 1,
    },
    iconWrap: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: c.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    groupName: {
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    groupValue: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    groupPct: {
      color: c.textFaint,
      fontSize: 12,
      fontWeight: '500',
      minWidth: 52,
      textAlign: 'right',
    },
    body: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
  });
}
