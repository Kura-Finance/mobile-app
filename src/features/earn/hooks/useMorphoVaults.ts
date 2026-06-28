import { useCallback, useEffect, useState } from 'react';
import i18n from '../../../shared/locales/i18n';
import { features } from '../../../config/features';
import { filterEarnVaultAllowlist, resolveEarnPositionVaultKey } from '../../../config/earn';
import {
  getMorphoVaultPositions,
  listEarnMorphoVaults,
  type MorphoVault,
  type MorphoVaultPosition,
} from '../../../lib/api/morpho/client';
import { loadEarnVaultPositionsOnChain } from '../utils/earnVaultPositions';

const CACHE_TTL_MS = 60_000;

let vaultCache: { vaults: MorphoVault[]; fetchedAt: number } | null = null;

export function useMorphoVaults(userAddress: string | null, enabled = features.morphoEarn) {
  const [vaults, setVaults] = useState<MorphoVault[]>([]);
  const [positionsByVault, setPositionsByVault] = useState<Record<string, MorphoVaultPosition>>({});
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!enabled) {
      setVaults([]);
      setPositionsByVault({});
      setLoading(false);
      setRefreshing(false);
      setError(null);
      return;
    }

    if (isRefresh) setRefreshing(true);
    else if (!vaultCache) setLoading(true);
    setError(null);

    try {
      const now = Date.now();
      let list = vaultCache && now - vaultCache.fetchedAt < CACHE_TTL_MS
        ? vaultCache.vaults
        : await listEarnMorphoVaults();

      list = filterEarnVaultAllowlist(list);

      if (!vaultCache || now - vaultCache.fetchedAt >= CACHE_TTL_MS) {
        vaultCache = { vaults: list, fetchedAt: now };
      }

      let positions: MorphoVaultPosition[] = [];
      let onChainByVault: Record<string, MorphoVaultPosition> = {};
      if (userAddress) {
        [positions, onChainByVault] = await Promise.all([
          getMorphoVaultPositions(userAddress).catch(() => []),
          loadEarnVaultPositionsOnChain(userAddress, list),
        ]);
      }

      const byVault: Record<string, MorphoVaultPosition> = {};
      for (const p of positions) {
        const key = resolveEarnPositionVaultKey(p.vaultAddress);
        if (!key) continue;

        const existing = byVault[key];
        byVault[key] = {
          vaultAddress: key,
          assetsUsd: (existing?.assetsUsd ?? 0) + p.assetsUsd,
          shares: existing?.shares ?? p.shares,
        };
      }

      for (const [key, p] of Object.entries(onChainByVault)) {
        if (p.assetsUsd > 0) {
          byVault[key] = p;
        }
      }

      setVaults(list);
      setPositionsByVault(byVault);
    } catch (err) {
      setError(err instanceof Error ? err.message : i18n.t('crypto.earnLoadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [enabled, userAddress]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(() => {
    vaultCache = null;
    void load(true);
  }, [load]);

  return { vaults, positionsByVault, loading, refreshing, error, refresh };
}
