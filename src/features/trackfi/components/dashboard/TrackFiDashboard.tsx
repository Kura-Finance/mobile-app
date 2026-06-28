/**
 * TrackFi unified dashboard — aligned with Home / Invest / Portfolio tab UX.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { View as SafeAreaView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../../shared/theme/theme';
import LoadingDots from '../../../../shared/components/LoadingDots';
import { useMoneyFormat } from '../../../../shared/hooks/useMoneyFormat';
import { useHideBalance } from '../../../../shared/hooks/useHideBalance';
import { useHeaderHeight } from '../../../../shared/navigation/Header';
import { useHeaderStore } from '../../../../shared/store/useHeaderStore';
import { HIDDEN_BALANCE_TEXT } from '../../../../shared/utils/privacyDisplay';
import { features } from '../../../../config/features';
import { useRefreshDashboardData } from '../../dashboard/hooks/useRefreshDashboardData';
import { useDefiPortfolio } from '../../hooks/useDefiPortfolio';
import { useAppStore } from '../../../../shared/store/useAppStore';
import { getAssetHistoryDaysLimit } from '../../../../shared/utils/membership';
import {
  getTrackFiChartRanges,
  TRACKFI_CHART_RANGE_LABEL_KEYS,
  useTrackFiDashboardData,
  type AccountCategory,
  type TrackFiChartRange,
} from '../../hooks/useTrackFiDashboardData';
import NetWorthChart from './NetWorthChart';
import TrackFiAllocation from './TrackFiAllocation';
import TrackFiLegalFooter from '../TrackFiLegalFooter';

const SCREEN_W = Dimensions.get('window').width;
const ACCOUNT_CARD_GAP = 8;
const CHART_W = SCREEN_W - 72;

type SubView = 'banking' | 'brokers' | 'debank';

interface Props {
  onNavigate: (view: SubView) => void;
  unlockSeq: number;
}

function formatSyncTime(ms: number | null, t: ReturnType<typeof useTranslation>['t']): string {
  if (!ms) return t('trackfi.dashboard.syncedJustNow');
  const diffMin = Math.floor((Date.now() - ms) / 60_000);
  if (diffMin < 1) return t('trackfi.dashboard.syncedJustNow');
  if (diffMin < 60) return t('trackfi.dashboard.syncedMinutes', { count: diffMin });
  return t('trackfi.dashboard.syncedHours', { count: Math.floor(diffMin / 60) });
}

function categoryShortTitleKey(category: AccountCategory): string {
  if (category.id === 'banking') return 'trackfi.dashboard.bankingShort';
  if (category.id === 'brokers') return 'trackfi.dashboard.brokersShort';
  return 'trackfi.dashboard.defiShort';
}

function AccountCategoryCard({
  category,
  onPress,
}: {
  category: AccountCategory;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const st = useMemo(() => makeCardStyles(colors), [colors]);

  const accent =
    category.id === 'banking' ? colors.primary
    : category.id === 'brokers' ? colors.success
    : colors.warning;

  return (
    <TouchableOpacity style={st.card} onPress={onPress} activeOpacity={0.82}>
      <View style={[st.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={category.icon as keyof typeof Ionicons.glyphMap} size={14} color={accent} />
      </View>
      <Text style={st.title} numberOfLines={2}>{t(categoryShortTitleKey(category))}</Text>
      <Text
        style={[st.total, { color: category.total < 0 ? colors.text : accent }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(category.total)}
      </Text>
      <Text style={st.meta} numberOfLines={1}>
        {t(category.countLabelKey, { count: category.count })}
      </Text>
    </TouchableOpacity>
  );
}

export default function TrackFiDashboard({ onNavigate, unlockSeq }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const money = useMoneyFormat();
  const hideBalance = useHideBalance();
  const headerHeight = useHeaderHeight();
  const setScrolled = useHeaderStore((s) => s.setScrolled);
  const st = useMemo(() => makeStyles(colors), [colors]);

  const membershipLabel = useAppStore((s) => s.userProfile.membershipLabel);
  const historyDaysLimit = useMemo(
    () => getAssetHistoryDaysLimit(membershipLabel),
    [membershipLabel],
  );
  const visibleChartRanges = useMemo(
    () => getTrackFiChartRanges(membershipLabel),
    [membershipLabel],
  );

  const [chartRange, setChartRange] = useState<TrackFiChartRange>('1W');

  useEffect(() => {
    if (!visibleChartRanges.includes(chartRange)) {
      setChartRange(visibleChartRanges[0] ?? '1W');
    }
  }, [visibleChartRanges, chartRange]);

  const data = useTrackFiDashboardData(true, chartRange, historyDaysLimit, unlockSeq);
  const { refresh } = useDefiPortfolio();
  const { refreshing, handleRefresh } = useRefreshDashboardData();

  const onPullRefresh = useCallback(async () => {
    await handleRefresh();
    await refresh();
  }, [handleRefresh, refresh]);

  const visibleCategories = useMemo(
    () => data.categories.filter((c) => c.id !== 'defi' || features.debank),
    [data.categories],
  );

  const changePositive = data.dayChange.change >= 0;
  const changeColor = changePositive ? colors.success : colors.danger;

  return (
    <SafeAreaView style={st.root}>
      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.scrollContent, { paddingTop: headerHeight + 8 }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onPullRefresh} tintColor={colors.primary} />
        }
      >
        {/* Balance — matches PortfolioScreen */}
        <View style={st.balanceSection}>
          <Text style={st.balanceLabel}>{t('trackfi.dashboard.totalNetWorth')}</Text>
          <Text style={st.syncText}>{formatSyncTime(data.lastSyncedMs, t)}</Text>

          <View style={st.balanceValueWrap}>
            {data.isLoading && data.netWorth === 0 ? (
              <LoadingDots color={colors.text} size={10} />
            ) : (
              <Text style={st.balanceValue}>
                {hideBalance ? HIDDEN_BALANCE_TEXT : money.compact(data.netWorth)}
              </Text>
            )}
            {!data.isLoading && !hideBalance && data.dayChange.hasBaseline && data.netWorth > 0 ? (
              <Text style={[st.todayChange, { color: changeColor }]}>
                {t('crypto.todayChange', {
                  amount: money.signedCompact(data.dayChange.change),
                  pct: `${changePositive ? '+' : '-'}${Math.abs(data.dayChange.pct).toFixed(2)}%`,
                })}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Chart card */}
        {(data.chartPrices.length >= 2 || data.isLoading) ? (
          <View style={st.chartCard}>
            <NetWorthChart
              prices={data.chartPrices}
              width={CHART_W}
              height={120}
              loading={data.isLoading}
              color={colors.primary}
            />
            <View style={st.tfRow}>
              {visibleChartRanges.map((range) => {
                const active = range === chartRange;
                return (
                  <TouchableOpacity
                    key={range}
                    onPress={() => setChartRange(range)}
                    style={[st.tfBtn, active && st.tfBtnActive]}
                    activeOpacity={0.7}
                  >
                    <Text style={[st.tfText, active && st.tfTextActive]}>
                      {t(TRACKFI_CHART_RANGE_LABEL_KEYS[range])}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* Accounts */}
        <View style={st.sectionHeader}>
          <Text style={st.sectionTitle}>{t('trackfi.dashboard.accounts')}</Text>
        </View>

        <View style={st.accountsRow}>
          {visibleCategories.map((cat) => (
            <AccountCategoryCard
              key={cat.id}
              category={cat}
              onPress={() => onNavigate(cat.navigateTo)}
            />
          ))}
        </View>

        {data.allocationDenominator > 0 ? (
          <TrackFiAllocation
            segments={data.allocation}
            denominator={data.allocationDenominator}
          />
        ) : null}

        <TrackFiLegalFooter style={{ paddingHorizontal: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
    },
    scroll: { flex: 1 },
    scrollContent: {
      paddingBottom: 120,
    },
    balanceSection: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    balanceLabel: {
      color: c.textFaint,
      fontSize: 13,
      fontWeight: '500',
      marginBottom: 4,
    },
    syncText: {
      color: c.textFaint,
      fontSize: 11,
      marginBottom: 6,
    },
    balanceValueWrap: {
      minHeight: 52,
      justifyContent: 'center',
    },
    balanceValue: {
      color: c.text,
      fontSize: 36,
      fontWeight: '700',
      letterSpacing: -1,
    },
    todayChange: {
      fontSize: 13,
      fontWeight: '600',
      marginTop: 4,
    },
    chartCard: {
      backgroundColor: c.surfaceAlt,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      padding: 16,
      marginHorizontal: 20,
      marginBottom: 20,
    },
    tfRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 4,
      marginTop: 12,
    },
    tfBtn: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: 8,
      alignItems: 'center',
    },
    tfBtnActive: {
      backgroundColor: c.surfaceInput,
    },
    tfText: {
      color: c.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    tfTextActive: {
      color: c.primary,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    sectionTitle: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
    },
    accountsRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      gap: ACCOUNT_CARD_GAP,
      marginBottom: 20,
    },
  });
}

function makeCardStyles(c: ThemeColors) {
  return StyleSheet.create({
    card: {
      flex: 1,
      minWidth: 0,
      backgroundColor: c.surfaceAlt,
      borderRadius: 12,
      padding: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    iconWrap: {
      width: 24,
      height: 24,
      borderRadius: 7,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    title: {
      color: c.text,
      fontSize: 10,
      fontWeight: '600',
      lineHeight: 13,
      marginBottom: 4,
      minHeight: 26,
    },
    total: {
      fontSize: 13,
      fontWeight: '700',
      letterSpacing: -0.3,
      marginBottom: 2,
    },
    meta: {
      color: c.textFaint,
      fontSize: 9,
    },
  });
}
