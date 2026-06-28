import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import LoadingDots from '../../../../shared/components/LoadingDots';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import BorrowDetailModal from '../../../borrow/modals/BorrowDetailModal';
import type { MorphoBorrowPosition, MorphoMarket } from '../../../../lib/api/morpho/markets';
import PortfolioBorrowRow from './PortfolioBorrowRow';

interface Props {
  scaAddress: string | null;
  markets: MorphoMarket[];
  positions: MorphoBorrowPosition[];
  positionsByMarket: Record<string, MorphoBorrowPosition>;
  totalBorrowedUsd: number;
  loading: boolean;
  onRefresh?: () => void;
}

export default function PortfolioBorrowGroup({
  scaAddress,
  markets,
  positions,
  positionsByMarket,
  totalBorrowedUsd,
  loading,
  onRefresh,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useMemo(() => makeStyles(colors), [colors]);
  const money = useMoneyFormat();
  const [expanded, setExpanded] = useState(totalBorrowedUsd > 0);
  const [selected, setSelected] = useState<MorphoMarket | null>(null);

  const activePositions = useMemo(
    () =>
      [...positions]
        .filter((p) => p.borrowAssetsUsd > 0)
        .sort((a, b) => b.borrowAssetsUsd - a.borrowAssetsUsd),
    [positions],
  );

  const marketById = useMemo(() => {
    const map = new Map<string, MorphoMarket>();
    for (const market of markets) {
      map.set(market.marketId.toLowerCase(), market);
    }
    return map;
  }, [markets]);

  const visibleLoans = useMemo(
    () =>
      activePositions
        .map((position) => {
          const market = marketById.get(position.marketId.toLowerCase());
          return market ? { market, position } : null;
        })
        .filter((item): item is { market: MorphoMarket; position: MorphoBorrowPosition } => item !== null),
    [activePositions, marketById],
  );

  const selectedPosition = selected
    ? positionsByMarket[selected.marketId.toLowerCase()]
    : null;

  const positionLabel = t('crypto.borrowPositionCount', { count: activePositions.length });

  return (
    <>
      <View style={st.card}>
        <TouchableOpacity
          style={st.header}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('crypto.borrow')}
        >
          <View style={st.headerLeft}>
            <View style={st.iconWrap}>
              <Ionicons name="arrow-down-circle-outline" size={18} color={colors.primary} />
            </View>
            <Text style={st.groupName}>{t('crypto.portfolioGroupBorrow')}</Text>
          </View>
          <View style={st.headerRight}>
            <Text style={st.groupValue}>{money.compact(totalBorrowedUsd)}</Text>
            <Text style={st.groupMeta} numberOfLines={1}>{positionLabel}</Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textFaint}
            />
          </View>
        </TouchableOpacity>

        {expanded && (
          <View style={st.body}>
            {loading && visibleLoans.length === 0 ? (
              <View style={st.loadingRow}>
                <LoadingDots color={colors.textMuted} size={8} />
              </View>
            ) : (
              visibleLoans.map(({ market, position }) => (
                <PortfolioBorrowRow
                  key={market.marketId}
                  market={market}
                  borrowedUsd={position.borrowAssetsUsd}
                  onPress={setSelected}
                />
              ))
            )}
          </View>
        )}
      </View>

      <BorrowDetailModal
        visible={!!selected}
        market={selected}
        scaAddress={scaAddress ?? ''}
        borrowedUsd={selectedPosition?.borrowAssetsUsd ?? 0}
        collateralUsd={selectedPosition?.collateralUsd ?? 0}
        borrowAssetsRaw={selectedPosition?.borrowAssets ?? '0'}
        onClose={() => setSelected(null)}
        onPositionChanged={onRefresh}
      />
    </>
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
      flexShrink: 1,
      maxWidth: '55%',
    },
    groupValue: {
      color: c.text,
      fontSize: 14,
      fontWeight: '700',
    },
    groupMeta: {
      color: c.textFaint,
      fontSize: 12,
      fontWeight: '500',
      flexShrink: 1,
    },
    body: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
    },
    loadingRow: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 24,
    },
  });
}
