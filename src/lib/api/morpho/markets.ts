/**
 * Morpho Blue markets on Base — borrow rate listings.
 * @see https://docs.morpho.org/tools/offchain/api/morpho/
 */

import { morphoQuery, MORPHO_BASE_CHAIN_ID } from './graphql';
import { filterMainstreamBorrowMarkets } from '../../../config/borrow';

export interface MorphoMarketAsset {
  symbol: string;
  address: string;
  decimals: number;
}

export interface MorphoMarket {
  marketId: string;
  lltv: string;
  loanAsset: MorphoMarketAsset;
  collateralAsset: MorphoMarketAsset;
  oracleAddress: string | null;
  irmAddress: string | null;
  borrowApy: number;
  avgNetBorrowApy: number;
  borrowAssetsUsd: number;
  supplyAssetsUsd: number;
  liquidityAssetsUsd: number;
  collateralAssetsUsd: number;
  utilization: number;
}

export interface MorphoBorrowPosition {
  marketId: string;
  loanSymbol: string;
  collateralSymbol: string;
  borrowAssetsUsd: number;
  collateralUsd: number;
  /** Loan token amount in base units (string integer). */
  borrowAssets: string;
}

interface GqlMarketItem {
  marketId: string;
  lltv: string;
  loanAsset: MorphoMarketAsset | null;
  collateralAsset: MorphoMarketAsset | null;
  oracle?: { address: string } | null;
  irmAddress?: string | null;
  state: {
    borrowApy: number;
    avgNetBorrowApy: number;
    borrowAssetsUsd: number;
    supplyAssetsUsd: number;
    liquidityAssetsUsd: number;
    collateralAssetsUsd: number;
    utilization: number;
  } | null;
}

function isValidMarketItem(item: GqlMarketItem): item is GqlMarketItem & {
  loanAsset: MorphoMarketAsset;
  collateralAsset: MorphoMarketAsset;
} {
  return Boolean(item.loanAsset?.symbol && item.collateralAsset?.symbol);
}

const MARKET_BY_ID_QUERY = `
  query MarketById($marketId: String!, $chainId: Int!) {
    marketById(marketId: $marketId, chainId: $chainId) {
      marketId
      lltv
      loanAsset { symbol address decimals }
      collateralAsset { symbol address decimals }
      oracle { address }
      irmAddress
      state {
        borrowApy
        avgNetBorrowApy
        borrowAssetsUsd
        supplyAssetsUsd
        liquidityAssetsUsd
        collateralAssetsUsd
        utilization
      }
    }
  }
`;

const LIST_MARKETS_QUERY = `
  query ListMarkets($first: Int!, $skip: Int!) {
    markets(
      first: $first
      skip: $skip
      orderBy: SupplyAssetsUsd
      orderDirection: Desc
      where: { chainId_in: [8453], listed: true }
    ) {
      items {
        marketId
        lltv
        loanAsset { symbol address decimals }
        collateralAsset { symbol address decimals }
        oracle { address }
        irmAddress
        state {
          borrowApy
          avgNetBorrowApy
          borrowAssetsUsd
          supplyAssetsUsd
          liquidityAssetsUsd
          collateralAssetsUsd
          utilization
        }
      }
    }
  }
`;

const USER_BORROW_POSITIONS_QUERY = `
  query UserBorrowPositions($address: String!) {
    marketPositions(
      first: 50
      orderBy: BorrowShares
      orderDirection: Desc
      where: {
        chainId_in: [8453]
        userAddress_in: [$address]
      }
    ) {
      items {
        market {
          marketId
          loanAsset { symbol }
          collateralAsset { symbol }
        }
        state {
          borrowAssetsUsd
          collateralUsd
          borrowAssets
        }
      }
    }
  }
`;

function mapMarket(
  item: GqlMarketItem & { loanAsset: MorphoMarketAsset; collateralAsset: MorphoMarketAsset },
): MorphoMarket {
  return {
    marketId: item.marketId,
    lltv: item.lltv,
    loanAsset: item.loanAsset,
    collateralAsset: item.collateralAsset,
    oracleAddress: item.oracle?.address ?? null,
    irmAddress: item.irmAddress ?? null,
    borrowApy: item.state?.borrowApy ?? 0,
    avgNetBorrowApy: item.state?.avgNetBorrowApy ?? 0,
    borrowAssetsUsd: item.state?.borrowAssetsUsd ?? 0,
    supplyAssetsUsd: item.state?.supplyAssetsUsd ?? 0,
    liquidityAssetsUsd: item.state?.liquidityAssetsUsd ?? 0,
    collateralAssetsUsd: item.state?.collateralAssetsUsd ?? 0,
    utilization: item.state?.utilization ?? 0,
  };
}

export type MorphoTimeseriesInterval = 'HOUR' | 'DAY';

const MARKET_BORROW_APY_HISTORY_QUERY = `
  query MarketBorrowApyHistory($marketId: String!, $chainId: Int!, $options: TimeseriesOptions!) {
    marketById(marketId: $marketId, chainId: $chainId) {
      historicalState {
        borrowApy(options: $options) {
          x
          y
        }
      }
    }
  }
`;

function extractApySeries(points: { x: number; y: number | null }[] | null | undefined): number[] {
  return (points ?? [])
    .filter(
      (p): p is { x: number; y: number } =>
        typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.y) && p.y >= 0,
    )
    .sort((a, b) => a.x - b.x)
    .map((p) => p.y);
}

/** Historical borrow APY (0–1 fractions) for market detail charts. */
export async function getMarketBorrowApyHistory(
  marketId: string,
  options: { startTimestamp: number; endTimestamp: number; interval: MorphoTimeseriesInterval },
): Promise<number[]> {
  const data = await morphoQuery<{
    marketById: {
      historicalState: {
        borrowApy: { x: number; y: number | null }[] | null;
      } | null;
    } | null;
  }>(MARKET_BORROW_APY_HISTORY_QUERY, {
    marketId,
    chainId: MORPHO_BASE_CHAIN_ID,
    options,
  });

  return extractApySeries(data.marketById?.historicalState?.borrowApy);
}

export function morphoMarketAppUrl(marketId: string): string {
  return `https://app.morpho.org/base/market/${marketId}`;
}

export async function fetchMarketById(marketId: string): Promise<MorphoMarket | null> {
  const data = await morphoQuery<{
    marketById: GqlMarketItem | null;
  }>(MARKET_BY_ID_QUERY, { marketId, chainId: MORPHO_BASE_CHAIN_ID });

  const item = data.marketById;
  if (!item || !isValidMarketItem(item)) return null;
  return mapMarket(item);
}

export async function fetchMorphoMarkets(
  options?: { includeMarketIds?: string[] },
): Promise<MorphoMarket[]> {
  const pageSize = 100;
  const data = await morphoQuery<{
    markets: { items: GqlMarketItem[] };
  }>(LIST_MARKETS_QUERY, { first: pageSize, skip: 0 });

  const raw = (data.markets?.items ?? [])
    .filter(isValidMarketItem)
    .map(mapMarket);

  const mainstream = filterMainstreamBorrowMarkets(raw);

  const included = new Set(mainstream.map((m) => m.marketId.toLowerCase()));
  const extraIds = (options?.includeMarketIds ?? []).filter(
    (id) => !included.has(id.toLowerCase()),
  );

  if (extraIds.length === 0) return mainstream;

  const extras = await Promise.all(extraIds.map((id) => fetchMarketById(id)));
  const validExtras = extras.filter((m): m is MorphoMarket => m !== null);

  const merged = [...mainstream];
  for (const market of validExtras) {
    if (!included.has(market.marketId.toLowerCase())) {
      merged.push(market);
      included.add(market.marketId.toLowerCase());
    }
  }

  return merged.sort((a, b) => b.supplyAssetsUsd - a.supplyAssetsUsd);
}

export async function fetchUserBorrowPositions(
  userAddress: string,
): Promise<MorphoBorrowPosition[]> {
  const normalized = userAddress.toLowerCase();
  const data = await morphoQuery<{
    marketPositions: {
      items: {
        market: {
          marketId: string;
          loanAsset: { symbol: string };
          collateralAsset: { symbol: string };
        };
        state: {
          borrowAssetsUsd: number;
          collateralUsd: number;
          borrowAssets: string;
        } | null;
      }[];
    };
  }>(USER_BORROW_POSITIONS_QUERY, { address: normalized });

  return (data.marketPositions?.items ?? [])
    .filter((item) => {
      const borrowed = item.state?.borrowAssetsUsd ?? 0;
      return borrowed > 0
        && item.market?.loanAsset?.symbol
        && item.market?.collateralAsset?.symbol;
    })
    .map((item) => ({
      marketId: item.market.marketId,
      loanSymbol: item.market.loanAsset!.symbol,
      collateralSymbol: item.market.collateralAsset!.symbol,
      borrowAssetsUsd: item.state?.borrowAssetsUsd ?? 0,
      collateralUsd: item.state?.collateralUsd ?? 0,
      borrowAssets: item.state?.borrowAssets ?? '0',
    }));
}

export { MORPHO_BASE_CHAIN_ID };
