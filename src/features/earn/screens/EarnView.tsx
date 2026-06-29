/**
 * Invest → Earn tab — Morpho vault listings on Base.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import VaultLogo from '../components/VaultLogo';
import InvestListCard from '../../crypto/components/invest/InvestListCard';
import InvestEmbeddedFlatList from '../../crypto/components/invest/InvestEmbeddedFlatList';
import EarnDetailModal from '../modals/EarnDetailModal';
import { useMorphoVaults } from '../hooks/useMorphoVaults';
import type { MorphoVault } from '../../../lib/api/morpho/client';
import { appliesEarnServiceFee, effectiveEarnNetApy } from '../../../config/earn';
import { matchesVault, normalizeSearchQuery } from '../../crypto/utils/portfolioSearch';
import { useFavoritesStore } from '../../crypto/store/useFavoritesStore';
import { earnFavoriteKey } from '../utils/earnFavorites';
import LegalDisclaimer from '../../../shared/components/LegalDisclaimer';
import LoadingDots from '../../../shared/components/LoadingDots';
import { useTheme } from '../../../shared/theme/ThemeContext';
import type { ThemeColors } from '../../../shared/theme/theme';
import { useMoneyFormat } from '../../../shared/hooks/useMoneyFormat';

function useStyles() {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
}

function formatApy(apy: number): string {
  if (!Number.isFinite(apy) || apy <= 0) return '—';
  return `${(apy * 100).toFixed(2)}%`;
}

function SectionDivider({ label }: { label: string }) {
  const st = useStyles();
  return (
    <View style={st.dividerWrap}>
      <View style={st.dividerLine} />
      <Text style={st.dividerLabel}>{label}</Text>
      <View style={st.dividerLine} />
    </View>
  );
}

function VaultRow({ vault, depositedUsd, onPress }: {
  vault: MorphoVault;
  depositedUsd: number;
  onPress: (vault: MorphoVault) => void;
}) {
  const { colors } = useTheme();
  const st = useStyles();
  const money = useMoneyFormat();
  const favorites = useFavoritesStore((s) => s.favorites);
  const toggleFavorite = useFavoritesStore((s) => s.toggleFavorite);
  const hasDeposit = depositedUsd > 0;
  const favKey = earnFavoriteKey(vault);
  const isFav = favorites.includes(favKey);

  return (
    <TouchableOpacity
      style={st.row}
      onPress={() => onPress(vault)}
      activeOpacity={0.65}
      delayPressIn={Platform.OS === 'android' ? 80 : 0}
    >
      <VaultLogo vault={vault} size={44} />
      <View style={st.mid}>
        <Text style={st.name} numberOfLines={1}>{vault.name}</Text>
        {hasDeposit ? (
          <Text style={st.holdingsValue}>{money.compact(depositedUsd)}</Text>
        ) : (
          <Text style={st.noHoldingsSub}>—</Text>
        )}
      </View>
      <View style={st.right}>
        <Text style={st.apy}>
          {formatApy(effectiveEarnNetApy(vault.netApy, appliesEarnServiceFee(vault.address)))}
        </Text>
        <Text style={st.asset}>{vault.asset.symbol}</Text>
      </View>
      <TouchableOpacity
        style={st.starBtn}
        onPress={() => toggleFavorite(favKey)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.6}
      >
        <Ionicons
          name={isFav ? 'star' : 'star-outline'}
          size={18}
          color={isFav ? '#F5AC37' : colors.textFaint}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

interface Props {
  embedded?: boolean;
  scaAddress: string;
  favoritesOnly?: boolean;
  searchQuery?: string;
  onRefresh: () => void;
  onScroll?: (offsetY: number) => void;
  onBindRefresh?: (refresh: (() => void) | null) => void;
  onRefreshingChange?: (refreshing: boolean) => void;
  externalSelectedVault?: MorphoVault | null;
  onExternalSelectedVaultHandled?: () => void;
}

type EarnListRow =
  | { kind: 'divider'; id: string; label: string }
  | { kind: 'vault'; id: string; vault: MorphoVault };

export default function EarnView({
  embedded = false,
  scaAddress,
  favoritesOnly = false,
  searchQuery = '',
  onRefresh,
  onScroll,
  onBindRefresh,
  onRefreshingChange,
  externalSelectedVault,
  onExternalSelectedVaultHandled,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
  const favorites = useFavoritesStore((s) => s.favorites);
  const { vaults, positionsByVault, loading, refreshing, error, refresh } = useMorphoVaults(scaAddress || null);

  const [selected, setSelected] = useState<MorphoVault | null>(null);

  React.useEffect(() => {
    if (externalSelectedVault) {
      setSelected(externalSelectedVault);
      onExternalSelectedVaultHandled?.();
    }
  }, [externalSelectedVault, onExternalSelectedVaultHandled]);

  const handleRefresh = useCallback(() => {
    refresh();
    onRefresh();
  }, [refresh, onRefresh]);

  React.useEffect(() => {
    onBindRefresh?.(refresh);
    return () => onBindRefresh?.(null);
  }, [refresh, onBindRefresh]);

  React.useEffect(() => {
    onRefreshingChange?.(refreshing);
  }, [refreshing, onRefreshingChange]);

  const sortedVaults = useMemo(
    () =>
      [...vaults].sort((a, b) => {
        const aUsd = positionsByVault[a.address.toLowerCase()]?.assetsUsd ?? 0;
        const bUsd = positionsByVault[b.address.toLowerCase()]?.assetsUsd ?? 0;
        return bUsd - aUsd;
      }),
    [vaults, positionsByVault],
  );

  const favoriteVaults = useMemo(
    () => sortedVaults.filter((vault) => favorites.includes(earnFavoriteKey(vault))),
    [sortedVaults, favorites],
  );

  const otherVaults = useMemo(
    () => sortedVaults.filter((vault) => !favorites.includes(earnFavoriteKey(vault))),
    [sortedVaults, favorites],
  );

  const query = normalizeSearchQuery(searchQuery);
  const isSearching = query.length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const pool = favoritesOnly ? favoriteVaults : sortedVaults;
    return pool.filter((vault) => matchesVault(vault, query));
  }, [favoriteVaults, favoritesOnly, isSearching, query, sortedVaults]);

  const displayRows = useMemo((): EarnListRow[] => {
    if (isSearching) {
      return searchResults.map((vault) => ({
        kind: 'vault',
        id: vault.address,
        vault,
      }));
    }
    if (favoritesOnly) {
      return favoriteVaults.map((vault) => ({
        kind: 'vault',
        id: vault.address,
        vault,
      }));
    }
    const rows: EarnListRow[] = [];
    if (favoriteVaults.length > 0) {
      rows.push({ kind: 'divider', id: 'divider-favorites', label: t('crypto.favorites') });
      for (const vault of favoriteVaults) {
        rows.push({ kind: 'vault', id: vault.address, vault });
      }
    }
    if (otherVaults.length > 0) {
      if (favoriteVaults.length > 0) {
        rows.push({ kind: 'divider', id: 'divider-watchlist', label: t('crypto.watchlist') });
      }
      for (const vault of otherVaults) {
        rows.push({ kind: 'vault', id: vault.address, vault });
      }
    }
    return rows;
  }, [
    favoriteVaults,
    favoritesOnly,
    isSearching,
    otherVaults,
    searchResults,
    t,
  ]);

  const listBody = loading && vaults.length === 0 ? (
    <View style={st.loadingRow}>
      <LoadingDots color={colors.textMuted} size={8} />
    </View>
  ) : vaults.length === 0 ? (
    <View style={st.empty}>
      <Text style={st.emptyText}>{t('crypto.earnEmpty')}</Text>
    </View>
  ) : displayRows.length === 0 ? (
    <View style={st.empty}>
      <Text style={st.emptyText}>
        {isSearching ? t('crypto.searchNoResults') : t('crypto.favoritesEmpty')}
      </Text>
    </View>
  ) : (
    <InvestEmbeddedFlatList
      data={displayRows}
      keyExtractor={(item) => item.id}
      rowHeight={0}
      renderItem={({ item }) => {
        if (item.kind === 'divider') {
          return <SectionDivider label={item.label} />;
        }
        return (
          <VaultRow
            vault={item.vault}
            depositedUsd={positionsByVault[item.vault.address.toLowerCase()]?.assetsUsd ?? 0}
            onPress={setSelected}
          />
        );
      }}
    />
  );

  return (
    <View style={embedded ? st.embedded : undefined}>
      {error && (
        <View style={st.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
          <Text style={st.errorText}>{error}</Text>
        </View>
      )}

      <InvestListCard
        leftLabel={t('crypto.colAsset')}
        rightLabel={t('crypto.colApy')}
        refreshing={embedded ? undefined : refreshing}
        onRefresh={embedded ? undefined : handleRefresh}
        onScroll={onScroll}
        outerScroll={embedded}
      >
        {listBody}
      </InvestListCard>

      {!embedded && (
        <View style={st.footer}>
          <Text style={st.sourceNote}>{t('crypto.earnSourceNote')}</Text>
          <LegalDisclaimer variant="earn" style={st.legalFooter} />
        </View>
      )}

      <EarnDetailModal
        visible={!!selected}
        vault={selected}
        scaAddress={scaAddress}
        depositedUsd={selected ? (positionsByVault[selected.address.toLowerCase()]?.assetsUsd ?? 0) : 0}
        onClose={() => setSelected(null)}
        onPositionChanged={handleRefresh}
      />
    </View>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    embedded: {},
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
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
    dividerWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 10,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.border,
    },
    dividerLabel: {
      color: c.textFaint,
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
      gap: 12,
    },
    mid: { flex: 1, gap: 4 },
    name: { color: c.text, fontSize: 15, fontWeight: '700' },
    holdingsValue: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
    noHoldingsSub: { color: c.textFaint, fontSize: 12, fontWeight: '500' },
    right: { alignItems: 'flex-end', gap: 3, minWidth: 72 },
    apy: { color: '#10B981', fontSize: 15, fontWeight: '700' },
    asset: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
    starBtn: { width: 28, alignItems: 'center', justifyContent: 'center' },
    sourceNote: { color: c.textFaint, fontSize: 11, textAlign: 'center', marginTop: 16 },
    footer: { paddingBottom: 120 },
    legalFooter: { marginTop: 8, paddingHorizontal: 16 },
  });
}
