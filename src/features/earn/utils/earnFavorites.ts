import type { MorphoVault } from '../../../lib/api/morpho/client';

export function earnFavoriteKey(vault: MorphoVault): string {
  return `earn:${vault.address.toLowerCase()}`;
}
