/**
 * Morpho public GraphQL API — vault listings on Base.
 * @see https://docs.morpho.org/tools/offchain/api/morpho-vaults/
 */

export { MORPHO_BASE_CHAIN_ID } from './graphql';
export {
  clearMorphoFeeWrapperCache,
  enrichVaultWithDepositTarget,
  loadMorphoFeeWrapperMap,
  resolveMorphoDepositVault,
} from './feeWrapper';

import { morphoQuery, MORPHO_BASE_CHAIN_ID } from './graphql';
import {
  filterEarnVaultAllowlist,
  getEarnVaultStatsSource,
  MORPHO_EARN_VAULT_ALLOWLIST,
} from '../../../config/earn';

export interface MorphoVaultAsset {
  symbol: string;
  address: string;
  decimals: number;
}

export interface MorphoVault {
  address: string;
  name: string;
  symbol: string;
  asset: MorphoVaultAsset;
  netApy: number;
  totalAssetsUsd: number;
  fee: number;
  sharePriceUsd: number;
  description: string | null;
  imageUrl: string | null;
  /** On-chain deposit target — fee wrapper when configured, else underlying vault. */
  depositAddress?: string;
  usesFeeWrapper?: boolean;
}

export interface MorphoVaultPosition {
  vaultAddress: string;
  assetsUsd: number;
  shares: string;
}

interface GqlVaultItem {
  address: string;
  name: string;
  symbol: string;
  asset: MorphoVaultAsset;
  state: {
    netApy: number;
    totalAssetsUsd: number;
    fee: number;
    sharePriceUsd: number;
  } | null;
  metadata: {
    description: string | null;
    image: string | null;
  } | null;
}

function mapVault(item: GqlVaultItem): MorphoVault {
  return {
    address: item.address,
    name: item.name,
    symbol: item.symbol,
    asset: item.asset,
    netApy: item.state?.netApy ?? 0,
    totalAssetsUsd: item.state?.totalAssetsUsd ?? 0,
    fee: item.state?.fee ?? 0,
    sharePriceUsd: item.state?.sharePriceUsd ?? 0,
    description: item.metadata?.description ?? null,
    imageUrl: item.metadata?.image ?? null,
  };
}

const LIST_VAULTS_QUERY = `
  query ListVaults($first: Int!, $skip: Int!) {
    vaults(
      first: $first
      skip: $skip
      orderBy: TotalAssetsUsd
      orderDirection: Desc
      where: { chainId_in: [8453], listed: true }
    ) {
      items {
        address
        name
        symbol
        asset { symbol address decimals }
        state { netApy totalAssetsUsd fee sharePriceUsd }
        metadata { description image }
      }
    }
  }
`;

const VAULT_BY_ADDRESS_QUERY = `
  query VaultByAddress($address: String!, $chainId: Int!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      asset { symbol address decimals }
      state { netApy totalAssetsUsd fee sharePriceUsd apy }
      metadata { description image }
    }
  }
`;

const USER_VAULT_POSITIONS_QUERY = `
  query UserVaultPositions($address: String!, $chainId: Int!) {
    userByAddress(address: $address, chainId: $chainId) {
      vaultPositions {
        vault { address }
        state { assetsUsd shares }
      }
    }
  }
`;

const VAULT_V2_BY_ADDRESS_QUERY = `
  query VaultV2ByAddress($address: String!, $chainId: Int!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      address
      name
      symbol
      asset { symbol address decimals }
      netApy
      totalAssetsUsd
      performanceFee
      sharePrice
      metadata { description image }
    }
  }
`;

interface GqlVaultV2Item {
  address: string;
  name: string;
  symbol: string;
  asset: MorphoVaultAsset;
  netApy: number | null;
  totalAssetsUsd: number | null;
  performanceFee: number | null;
  sharePrice: number | null;
  metadata: {
    description: string | null;
    image: string | null;
  } | null;
}

function mapVaultV2(item: GqlVaultV2Item): MorphoVault {
  return {
    address: item.address,
    name: item.name,
    symbol: item.symbol,
    asset: item.asset,
    netApy: item.netApy ?? 0,
    totalAssetsUsd: item.totalAssetsUsd ?? 0,
    fee: item.performanceFee ?? 0,
    sharePriceUsd: item.sharePrice ?? 0,
    description: item.metadata?.description ?? null,
    imageUrl: item.metadata?.image ?? null,
  };
}

async function getMorphoVaultV2(address: string): Promise<MorphoVault | null> {
  const data = await morphoQuery<{ vaultV2ByAddress: GqlVaultV2Item | null }>(
    VAULT_V2_BY_ADDRESS_QUERY,
    { address, chainId: MORPHO_BASE_CHAIN_ID },
  );
  return data.vaultV2ByAddress ? mapVaultV2(data.vaultV2ByAddress) : null;
}

/** Merge TVL/APY from a display stats source while keeping deposit routing address. */
async function enrichVaultDisplayStats(vault: MorphoVault): Promise<MorphoVault> {
  const statsSource = getEarnVaultStatsSource(vault.address);
  if (!statsSource) return vault;

  const v1Data = await morphoQuery<{ vaultByAddress: GqlVaultItem | null }>(
    VAULT_BY_ADDRESS_QUERY,
    { address: statsSource, chainId: MORPHO_BASE_CHAIN_ID },
  );
  if (v1Data.vaultByAddress) {
    const stats = mapVault(v1Data.vaultByAddress);
    return {
      ...vault,
      netApy: stats.netApy,
      totalAssetsUsd: stats.totalAssetsUsd,
      fee: stats.fee,
      sharePriceUsd: stats.sharePriceUsd,
    };
  }

  const v2Stats = await getMorphoVaultV2(statsSource);
  if (v2Stats) {
    return {
      ...vault,
      netApy: v2Stats.netApy,
      totalAssetsUsd: v2Stats.totalAssetsUsd,
      fee: v2Stats.fee,
      sharePriceUsd: v2Stats.sharePriceUsd,
    };
  }

  return vault;
}

export async function listMorphoVaults(options?: { first?: number; skip?: number }): Promise<MorphoVault[]> {
  const first = options?.first ?? 100;
  const skip = options?.skip ?? 0;
  const data = await morphoQuery<{ vaults: { items: GqlVaultItem[] } }>(
    LIST_VAULTS_QUERY,
    { first, skip },
  );
  return (data.vaults?.items ?? []).map(mapVault);
}

/** Listed earn vaults: V1 bulk list + V2 fetch for allowlisted addresses missing from V1. */
export async function listEarnMorphoVaults(): Promise<MorphoVault[]> {
  const v1List = await listMorphoVaults({ first: 100 });
  const byAddress = new Map(v1List.map((v) => [v.address.toLowerCase(), v]));

  const missing = MORPHO_EARN_VAULT_ALLOWLIST.filter(
    (addr) => !byAddress.has(addr.toLowerCase()),
  );
  if (missing.length > 0) {
    const supplemental = await Promise.all(missing.map((addr) => getMorphoVaultV2(addr)));
    for (const vault of supplemental) {
      if (vault) byAddress.set(vault.address.toLowerCase(), vault);
    }
  }

  return Promise.all(
    filterEarnVaultAllowlist(Array.from(byAddress.values())).map(enrichVaultDisplayStats),
  );
}

export async function getMorphoVault(address: string): Promise<MorphoVault | null> {
  const data = await morphoQuery<{ vaultByAddress: GqlVaultItem | null }>(
    VAULT_BY_ADDRESS_QUERY,
    { address, chainId: MORPHO_BASE_CHAIN_ID },
  );
  const vault = data.vaultByAddress
    ? mapVault(data.vaultByAddress)
    : await getMorphoVaultV2(address);
  if (!vault) return null;
  return enrichVaultDisplayStats(vault);
}

export type MorphoTimeseriesInterval = 'HOUR' | 'DAY';

const VAULT_NET_APY_HISTORY_QUERY = `
  query VaultNetApyHistory($address: String!, $chainId: Int!, $options: TimeseriesOptions!) {
    vaultByAddress(address: $address, chainId: $chainId) {
      historicalState {
        netApy(options: $options) {
          x
          y
        }
      }
    }
  }
`;

const VAULT_V2_NET_APY_HISTORY_QUERY = `
  query VaultV2NetApyHistory($address: String!, $chainId: Int!, $options: TimeseriesOptions!) {
    vaultV2ByAddress(address: $address, chainId: $chainId) {
      historicalState {
        avgNetApy(options: $options) {
          x
          y
        }
      }
    }
  }
`;

/** Sort chronologically and drop likely bad V2 avgNetApy spikes (e.g. near-zero gaps). */
function extractApySeries(points: Array<{ x: number; y: number | null }> | null | undefined): number[] {
  const sorted = (points ?? [])
    .filter(
      (p): p is { x: number; y: number } =>
        typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.y) && p.y > 0,
    )
    .sort((a, b) => a.x - b.x);

  if (sorted.length < 2) return sorted.map((p) => p.y);

  const values = sorted.map((p) => p.y);
  const max = Math.max(...values);
  const floor = Math.max(0.005, max * 0.25);
  const filtered = values.filter((y) => y >= floor);
  return filtered.length >= 2 ? filtered : values;
}

/** Historical net APY (0–1 fractions) for vault detail charts. */
export async function getVaultNetApyHistory(
  address: string,
  options: { startTimestamp: number; endTimestamp: number; interval: MorphoTimeseriesInterval },
): Promise<number[]> {
  const vars = { address, chainId: MORPHO_BASE_CHAIN_ID, options };

  try {
    const v1 = await morphoQuery<{
      vaultByAddress: {
        historicalState: {
          netApy: Array<{ x: number; y: number | null }> | null;
        } | null;
      } | null;
    }>(VAULT_NET_APY_HISTORY_QUERY, vars);

    const v1Series = extractApySeries(v1.vaultByAddress?.historicalState?.netApy);
    if (v1Series.length >= 2) return v1Series;
  } catch {
    // V2-only vaults return NOT_FOUND on the V1 endpoint — fall through.
  }

  const v2 = await morphoQuery<{
    vaultV2ByAddress: {
      historicalState: {
        avgNetApy: Array<{ x: number; y: number | null }> | null;
      } | null;
    } | null;
  }>(VAULT_V2_NET_APY_HISTORY_QUERY, vars);

  return extractApySeries(v2.vaultV2ByAddress?.historicalState?.avgNetApy);
}

export async function getMorphoVaultPositions(userAddress: string): Promise<MorphoVaultPosition[]> {
  const data = await morphoQuery<{
    userByAddress: {
      vaultPositions: Array<{
        vault: { address: string };
        state: { assetsUsd: number; shares: string } | null;
      }>;
    } | null;
  }>(USER_VAULT_POSITIONS_QUERY, {
    address: userAddress,
    chainId: MORPHO_BASE_CHAIN_ID,
  });

  const positions = data.userByAddress?.vaultPositions ?? [];
  return positions
    .filter((p) => p.state && p.state.assetsUsd > 0)
    .map((p) => ({
      vaultAddress: p.vault.address.toLowerCase(),
      assetsUsd: p.state!.assetsUsd,
      shares: p.state!.shares,
    }));
}

export function morphoVaultAppUrl(vaultAddress: string): string {
  return `https://app.morpho.org/base/vault/${vaultAddress}`;
}
