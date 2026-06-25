/**
 * Discover → Earn tab — Morpho vault listings on Base.
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

import VaultLogo from '../components/VaultLogo';
import EarnDetailModal from '../modals/EarnDetailModal';
import { useMorphoVaults } from '../hooks/useMorphoVaults';
import type { MorphoVault } from '../../../lib/api/morpho/client';
import { appliesEarnServiceFee, effectiveEarnNetApy } from '../../../config/earn';
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

function formatTvl(usd: number, compact: (n: number) => string): string {
  if (!Number.isFinite(usd) || usd <= 0) return '—';
  return compact(usd);
}

interface VaultRowProps {
  vault: MorphoVault;
  depositedUsd: number;
  onPress: (vault: MorphoVault) => void;
}

function VaultRow({ vault, depositedUsd, onPress }: VaultRowProps) {
  const { colors } = useTheme();
  const st = useStyles();
  const money = useMoneyFormat();
  const hasDeposit = depositedUsd > 0;

  return (
    <TouchableOpacity style={st.row} onPress={() => onPress(vault)} activeOpacity={0.65}>
      <VaultLogo vault={vault} size={44} />
      <View style={st.mid}>
        <Text style={st.name} numberOfLines={1}>{vault.name}</Text>
        <Text style={st.asset}>{vault.asset.symbol}</Text>
      </View>
      <View style={st.right}>
        <Text style={st.apy}>
          {formatApy(effectiveEarnNetApy(vault.netApy, appliesEarnServiceFee(vault.address)))}
        </Text>
        {hasDeposit ? (
          <Text style={st.deposited}>{money.compact(depositedUsd)}</Text>
        ) : (
          <Text style={st.tvl}>{formatTvl(vault.totalAssetsUsd, money.compact)}</Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
    </TouchableOpacity>
  );
}

interface Props {
  scaAddress: string;
  favoritesOnly?: boolean;
  onRefresh: () => void;
  externalSelectedVault?: MorphoVault | null;
  onExternalSelectedVaultHandled?: () => void;
}

export default function EarnView({
  scaAddress,
  favoritesOnly: _favoritesOnly = false,
  onRefresh,
  externalSelectedVault,
  onExternalSelectedVaultHandled,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const st = useStyles();
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

  const sortedVaults = useMemo(
    () =>
      [...vaults].sort((a, b) => {
        const aUsd = positionsByVault[a.address.toLowerCase()]?.assetsUsd ?? 0;
        const bUsd = positionsByVault[b.address.toLowerCase()]?.assetsUsd ?? 0;
        return bUsd - aUsd;
      }),
    [vaults, positionsByVault],
  );

  return (
    <View style={st.flex}>
      {error && (
        <View style={st.errorBox}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
          <Text style={st.errorText}>{error}</Text>
        </View>
      )}

      <View style={st.listHost}>
        <View style={st.card}>
          <View style={st.colHeader}>
            <Text style={st.colLabel}>{t('crypto.colVault')}</Text>
            <Text style={[st.colLabel, { textAlign: 'right' }]}>{t('crypto.colApy')}</Text>
          </View>

          <ScrollView
            style={st.listScroll}
            contentContainerStyle={st.listScrollContent}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
          >
            {loading && vaults.length === 0 ? (
              <View style={st.loadingRow}>
                <LoadingDots color={colors.textMuted} size={8} />
              </View>
            ) : vaults.length === 0 ? (
              <View style={st.empty}>
                <Text style={st.emptyText}>{t('crypto.earnEmpty')}</Text>
              </View>
            ) : (
              sortedVaults.map((vault) => (
                <VaultRow
                  key={vault.address}
                  vault={vault}
                  depositedUsd={positionsByVault[vault.address.toLowerCase()]?.assetsUsd ?? 0}
                  onPress={setSelected}
                />
              ))
            )}
          </ScrollView>
        </View>
      </View>

      <View style={st.footer}>
        <Text style={st.sourceNote}>{t('crypto.earnSourceNote')}</Text>
        <LegalDisclaimer variant="earn" style={st.legalFooter} />
      </View>

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
    flex: { flex: 1 },
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
    listHost: {
      flex: 1,
      minHeight: 0,
      marginHorizontal: 16,
    },
    card: {
      flex: 1,
      backgroundColor: c.surfaceAlt,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    listScroll: { flex: 1 },
    listScrollContent: { flexGrow: 1 },
    colHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.border,
    },
    colLabel: {
      color: c.textFaint,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
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
    asset: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
    right: { alignItems: 'flex-end', gap: 3, minWidth: 72 },
    apy: { color: '#10B981', fontSize: 15, fontWeight: '700' },
    tvl: { color: c.textMuted, fontSize: 12 },
    deposited: { color: c.textMuted, fontSize: 12 },
    sourceNote: { color: c.textFaint, fontSize: 11, textAlign: 'center', marginTop: 16 },
    footer: { paddingBottom: 120 },
    legalFooter: { marginTop: 8, paddingHorizontal: 16 },
  });
}
