/**
 * Morpho fee-wrapper resolution — merges env overrides with API discovery.
 */
import {
  hasEarnFee,
  EARN_FEE_RECIPIENT,
  MORPHO_EARN_FEE_RATE,
} from '../../../config/earn';
import {
  isMorphoFeeWrapperAutoDiscoverEnabled,
  MORPHO_FEE_WRAPPER_OVERRIDES,
  normalizeMorphoVaultAddress,
  resolveMorphoDepositFromMap,
  type MorphoFeeWrapperMap,
} from '../../../config/earnFeeWrapper';
import { morphoQuery, MORPHO_BASE_CHAIN_ID } from './graphql';

interface GqlFeeWrapperItem {
  address: string;
  performanceFee: number;
  performanceFeeRecipient: string;
  adapters: {
    items: {
      innerVault?: { address: string } | null;
    }[];
  } | null;
}

const FEE_WRAPPER_CACHE_TTL_MS = 5 * 60_000;
let feeWrapperCache: { map: MorphoFeeWrapperMap; fetchedAt: number } | null = null;

const LIST_FEE_WRAPPERS_QUERY = `
  query ListFeeWrappers($first: Int!) {
    vaultV2s(
      first: $first
      where: { chainId_in: [8453], type_in: [FeeWrapper] }
    ) {
      items {
        address
        performanceFee
        performanceFeeRecipient
        adapters {
          items {
            ... on MorphoVaultV2Adapter {
              innerVault { address }
            }
          }
        }
      }
    }
  }
`;

function feeMatches(expected: number, actual: number): boolean {
  return Math.abs(expected - actual) < 0.001;
}

async function discoverFeeWrappersFromApi(): Promise<MorphoFeeWrapperMap> {
  const map: MorphoFeeWrapperMap = {};

  if (!hasEarnFee() || !isMorphoFeeWrapperAutoDiscoverEnabled()) {
    return map;
  }

  try {
    const data = await morphoQuery<{ vaultV2s: { items: GqlFeeWrapperItem[] } }>(
      LIST_FEE_WRAPPERS_QUERY,
      { first: 200 },
    );
    for (const item of data.vaultV2s?.items ?? []) {
      if (!feeMatches(MORPHO_EARN_FEE_RATE, item.performanceFee)) continue;
      if (item.performanceFeeRecipient.toLowerCase() !== EARN_FEE_RECIPIENT.toLowerCase()) {
        continue;
      }
      for (const adapter of item.adapters?.items ?? []) {
        const inner = adapter.innerVault?.address;
        if (inner && !map[normalizeMorphoVaultAddress(inner)]) {
          map[normalizeMorphoVaultAddress(inner)] = item.address as `0x${string}`;
        }
      }
    }
  } catch {
    // Caller keeps env overrides only.
  }

  return map;
}

/** Load merged map: env overrides first, then API discovery (without overwriting env). */
export async function loadMorphoFeeWrapperMap(): Promise<MorphoFeeWrapperMap> {
  const now = Date.now();
  if (feeWrapperCache && now - feeWrapperCache.fetchedAt < FEE_WRAPPER_CACHE_TTL_MS) {
    return feeWrapperCache.map;
  }

  const discovered = await discoverFeeWrappersFromApi();
  const map: MorphoFeeWrapperMap = { ...discovered, ...MORPHO_FEE_WRAPPER_OVERRIDES };

  feeWrapperCache = { map, fetchedAt: now };
  return map;
}

export function clearMorphoFeeWrapperCache(): void {
  feeWrapperCache = null;
}

export async function resolveMorphoDepositVault(innerVaultAddress: string): Promise<{
  depositAddress: string;
  usesFeeWrapper: boolean;
}> {
  const map = await loadMorphoFeeWrapperMap();
  return resolveMorphoDepositFromMap(innerVaultAddress, map);
}

export async function enrichVaultWithDepositTarget<V extends { address: string }>(
  vault: V,
): Promise<V & { depositAddress: string; usesFeeWrapper: boolean }> {
  const { depositAddress, usesFeeWrapper } = await resolveMorphoDepositVault(vault.address);
  return { ...vault, depositAddress, usesFeeWrapper };
}

/** @internal chain id re-export for fee-wrapper queries */
export { MORPHO_BASE_CHAIN_ID };
