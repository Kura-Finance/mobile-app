import { useCallback, useEffect, useState } from 'react';

import {
  enrichVaultWithDepositTarget,
  type MorphoVault,
} from '../../../lib/api/morpho/client';
import { readMorphoVaultPosition } from '../../../lib/wallet/morphoVault';

export interface MorphoVaultPositionDetail {
  depositAddress: string;
  usesFeeWrapper: boolean;
  assetsFormatted: number;
  loading: boolean;
}

export function useMorphoVaultPosition(
  vault: MorphoVault | null,
  scaAddress: string,
  refreshKey = 0,
): MorphoVaultPositionDetail {
  const [depositAddress, setDepositAddress] = useState('');
  const [usesFeeWrapper, setUsesFeeWrapper] = useState(false);
  const [assetsFormatted, setAssetsFormatted] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!vault || !scaAddress) {
      setDepositAddress('');
      setUsesFeeWrapper(false);
      setAssetsFormatted(0);
      return;
    }
    setLoading(true);
    try {
      const enriched = await enrichVaultWithDepositTarget(vault);
      const target = enriched.depositAddress ?? vault.address;
      const wrapper = enriched.usesFeeWrapper ?? false;
      setDepositAddress(target);
      setUsesFeeWrapper(wrapper);
      const position = await readMorphoVaultPosition(
        target as `0x${string}`,
        scaAddress as `0x${string}`,
        vault.asset.decimals,
      );
      setAssetsFormatted(position.assetsFormatted);
    } catch {
      setAssetsFormatted(0);
    } finally {
      setLoading(false);
    }
  }, [vault, scaAddress]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return { depositAddress, usesFeeWrapper, assetsFormatted, loading };
}
