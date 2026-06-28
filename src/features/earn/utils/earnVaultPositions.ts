import { resolveMorphoDepositFromMap } from '../../../config/earnFeeWrapper';
import { loadMorphoFeeWrapperMap } from '../../../lib/api/morpho/feeWrapper';
import type { MorphoVault, MorphoVaultPosition } from '../../../lib/api/morpho/client';
import { readMorphoVaultPosition } from '../../../lib/wallet/morphoVault';

/** On-chain ERC-4626 balances keyed by listed (inner) vault address. */
export async function loadEarnVaultPositionsOnChain(
  userAddress: string,
  vaults: MorphoVault[],
): Promise<Record<string, MorphoVaultPosition>> {
  if (!userAddress || vaults.length === 0) return {};

  const wrapperMap = await loadMorphoFeeWrapperMap();
  const owner = userAddress as `0x${string}`;
  const out: Record<string, MorphoVaultPosition> = {};

  await Promise.all(
    vaults.map(async (vault) => {
      const key = vault.address.toLowerCase();
      const { depositAddress } = resolveMorphoDepositFromMap(vault.address, wrapperMap);
      try {
        const pos = await readMorphoVaultPosition(
          depositAddress as `0x${string}`,
          owner,
          vault.asset.decimals,
        );
        if (pos.assetsFormatted <= 0) return;

        // Underlying is USDC/EURC — token amount ≈ USD for list display.
        out[key] = {
          vaultAddress: key,
          assetsUsd: pos.assetsFormatted,
          shares: pos.shares.toString(),
        };
      } catch {
        // Skip vaults that fail to read (e.g. RPC hiccup).
      }
    }),
  );

  return out;
}
