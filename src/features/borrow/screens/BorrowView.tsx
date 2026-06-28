/**
 * Borrow hub — credit summary, active loans, and collateral markets.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import LoadingDots from '../../../shared/components/LoadingDots';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMorphoBorrow } from '../hooks/useMorphoBorrow';
import { useBorrowOnChainPositions } from '../hooks/useBorrowOnChainPositions';
import { useBorrowMaxByMarket } from '../hooks/useBorrowMaxByMarket';
import { useKuraCardWallet } from '../../card/context/KuraCardWalletContext';
import type { MorphoMarket } from '../../../lib/api/morpho/markets';
import BorrowDetailModal from '../modals/BorrowDetailModal';
import BorrowCreditCard from '../components/BorrowCreditCard';
import BorrowLoanCard from '../components/BorrowLoanCard';
import BorrowCollateralRow from '../components/BorrowCollateralRow';
import SourceAndLegalFooter from '../../crypto/components/SourceAndLegalFooter';
import {
  activeLoanEntries,
  filterBorrowWithMarkets,
  pickMarketsByCollateral,
} from '../utils/borrowHub';

const LOAN_PREVIEW_COUNT = 3;

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

interface Props {
  scaAddress: string | null;
  onBindRefresh?: (refresh: (() => void) | null) => void;
  onRefreshingChange?: (refreshing: boolean) => void;
}

export default function BorrowView({
  scaAddress,
  onBindRefresh,
  onRefreshingChange,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const [selected, setSelected] = useState<MorphoMarket | null>(null);
  const [showAllLoans, setShowAllLoans] = useState(false);

  const {
    markets,
    positionsByMarket,
    loading,
    refreshing,
    error,
    refresh,
  } = useMorphoBorrow(scaAddress);

  const collateralMarkets = useMemo(
    () => pickMarketsByCollateral(markets),
    [markets],
  );

  const { onChainPositionsByMarket, refreshOnChainPositions } = useBorrowOnChainPositions(
    scaAddress,
    collateralMarkets,
  );

  const mergedPositionsByMarket = useMemo(() => {
    const merged = { ...positionsByMarket };
    for (const [id, onChain] of Object.entries(onChainPositionsByMarket)) {
      const indexed = merged[id];
      if (!indexed || onChain.borrowAssetsUsd > indexed.borrowAssetsUsd) {
        merged[id] = onChain;
      } else if (indexed.borrowAssetsUsd <= 0 && onChain.borrowAssetsUsd > 0) {
        merged[id] = onChain;
      } else if (indexed && onChain.collateralUsd > indexed.collateralUsd) {
        merged[id] = { ...indexed, collateralUsd: onChain.collateralUsd };
      }
    }
    return merged;
  }, [positionsByMarket, onChainPositionsByMarket]);

  const mergedPositions = useMemo(
    () => Object.values(mergedPositionsByMarket),
    [mergedPositionsByMarket],
  );

  const { balances: walletBalances, refreshBalance: refreshWalletBalances } = useKuraCardWallet();
  const {
    maxByMarketId,
    collateralUsdByMarketId,
    loading: maxBorrowLoading,
    refresh: refreshMaxBorrow,
  } = useBorrowMaxByMarket(
    scaAddress,
    collateralMarkets,
    positionsByMarket,
    walletBalances,
  );

  const availableCreditUsd = useMemo(
    () => Object.values(maxByMarketId).reduce((sum, amount) => sum + Math.max(0, amount), 0),
    [maxByMarketId],
  );

  const totalBorrowCollateralUsd = useMemo(
    () => Object.values(collateralUsdByMarketId).reduce((sum, amount) => sum + Math.max(0, amount), 0),
    [collateralUsdByMarketId],
  );

  React.useEffect(() => {
    onBindRefresh?.(refresh);
    return () => onBindRefresh?.(null);
  }, [refresh, onBindRefresh]);

  React.useEffect(() => {
    onRefreshingChange?.(refreshing);
  }, [refreshing, onRefreshingChange]);

  const loans = useMemo(
    () => activeLoanEntries(mergedPositions, markets),
    [mergedPositions, markets],
  );

  const borrowWithMarkets = useMemo(
    () => filterBorrowWithMarkets(collateralMarkets, loans),
    [collateralMarkets, loans],
  );

  const visibleLoans = showAllLoans ? loans : loans.slice(0, LOAN_PREVIEW_COUNT);
  const hasMoreLoans = loans.length > LOAN_PREVIEW_COUNT;

  const selectedPosition = selected
    ? mergedPositionsByMarket[selected.marketId.toLowerCase()]
    : null;

  const handleRefresh = useCallback(() => {
    refresh();
    void refreshWalletBalances();
    refreshMaxBorrow();
    void refreshOnChainPositions();
  }, [refresh, refreshWalletBalances, refreshMaxBorrow, refreshOnChainPositions]);

  if (loading && markets.length === 0) {
    return (
      <View style={st.loadingWrap}>
        <LoadingDots color={colors.textMuted} size={8} />
      </View>
    );
  }

  return (
    <View style={st.root}>
      {error ? (
        <View style={st.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
          <Text style={st.errorText}>{error}</Text>
        </View>
      ) : null}

      <BorrowCreditCard
        availableCreditUsd={availableCreditUsd}
        totalCollateralUsd={totalBorrowCollateralUsd}
        loading={loading || maxBorrowLoading}
      />

      {loans.length > 0 ? (
        <View style={st.section}>
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>{t('crypto.borrowMyLoans')}</Text>
            {hasMoreLoans ? (
              <TouchableOpacity
                onPress={() => setShowAllLoans((v) => !v)}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Text style={st.sectionAction}>
                  {showAllLoans ? t('crypto.borrowShowLess') : t('crypto.borrowViewAll')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          {visibleLoans.map(({ market, position }) => (
            <BorrowLoanCard
              key={market.marketId}
              market={market}
              position={position}
              onPress={() => setSelected(market)}
            />
          ))}
        </View>
      ) : null}

      {borrowWithMarkets.length > 0 || collateralMarkets.length === 0 ? (
      <View style={st.section}>
        <Text style={[st.sectionTitle, st.sectionTitlePadded]}>
          {t('crypto.borrowWith')}
        </Text>
        <View style={st.listCard}>
          {borrowWithMarkets.length === 0 ? (
            <View style={st.empty}>
              <Text style={st.emptyText}>{t('crypto.borrowEmpty')}</Text>
            </View>
          ) : (
            borrowWithMarkets.map((market, index) => (
              <BorrowCollateralRow
                key={market.marketId}
                market={market}
                maxBorrowUsd={
                  maxByMarketId[market.marketId.toLowerCase()] ?? null
                }
                isLast={index === borrowWithMarkets.length - 1}
                onPress={() => setSelected(market)}
              />
            ))
          )}
        </View>
      </View>
      ) : null}

      <SourceAndLegalFooter
        legalVariant="borrow"
        sourceNote={t('crypto.footerSourceBorrow')}
      />

      <BorrowDetailModal
        visible={!!selected}
        market={selected}
        scaAddress={scaAddress ?? ''}
        borrowedUsd={selectedPosition?.borrowAssetsUsd ?? 0}
        collateralUsd={selectedPosition?.collateralUsd ?? 0}
        borrowAssetsRaw={selectedPosition?.borrowAssets ?? '0'}
        onClose={() => setSelected(null)}
        onPositionChanged={handleRefresh}
      />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
    },
    loadingWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 48,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 20,
      marginBottom: 12,
      backgroundColor: 'rgba(239,68,68,0.08)',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(239,68,68,0.2)',
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    errorText: { color: c.danger, fontSize: 12, flex: 1 },
    section: {
      marginBottom: 8,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: '800',
    },
    sectionTitlePadded: {
      paddingHorizontal: 20,
      marginBottom: 10,
    },
    sectionAction: {
      color: c.primary,
      fontSize: 14,
      fontWeight: '600',
    },
    listCard: {
      marginHorizontal: 20,
      borderRadius: 16,
      backgroundColor: c.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      overflow: 'hidden',
    },
    empty: {
      alignItems: 'center',
      paddingHorizontal: 24,
      paddingVertical: 28,
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
  });
}
