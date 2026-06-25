import { useCallback, useEffect, useState } from 'react';
import i18n from '../../../shared/locales/i18n';
import { features } from '../../../config/features';
import { filterEarnVaultAllowlist, isEarnVaultAllowed } from '../../../config/earn';
import {
  getMorphoVaultPositions,
  listEarnMorphoVaults,
  type MorphoVault,
  type MorphoVaultPosition,
} from '../../../lib/api/morpho/client';

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
      if (userAddress) {
        positions = await getMorphoVaultPositions(userAddress).catch(() => []);
      }

      const byVault: Record<string, MorphoVaultPosition> = {};
      for (const p of positions) {
        if (isEarnVaultAllowed(p.vaultAddress)) {
          byVault[p.vaultAddress] = p;
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
