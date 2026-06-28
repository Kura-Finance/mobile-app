import { describe, expect, test } from 'vitest';

import { isMainstreamBorrowMarket } from '../borrow';
import type { MorphoMarket } from '../../lib/api/morpho/markets';

function market(partial: Partial<MorphoMarket> & Pick<MorphoMarket, 'collateralAsset'>): MorphoMarket {
  return {
    marketId: '0x1',
    lltv: '860000000000000000',
    loanAsset: { symbol: 'USDC', address: '0x', decimals: 6 },
    oracleAddress: '0xoracle',
    irmAddress: '0xirm',
    borrowApy: 0.05,
    avgNetBorrowApy: 0.05,
    borrowAssetsUsd: 0,
    supplyAssetsUsd: 2_000_000,
    liquidityAssetsUsd: 200_000,
    collateralAssetsUsd: 1_000_000,
    utilization: 0.5,
    ...partial,
  };
}

describe('isMainstreamBorrowMarket', () => {
  test('includes cbDOGE/USDC below global TVL floor', () => {
    const cbDoge = market({
      collateralAsset: {
        symbol: 'cbDOGE',
        address: '0xcbD06E5A2B0C65597161de254AA074E489dEb510',
        decimals: 8,
      },
      supplyAssetsUsd: 2_000_000,
    });

    expect(isMainstreamBorrowMarket(cbDoge)).toBe(true);
  });

  test('excludes cbDOGE when TVL is below collateral override', () => {
    const cbDoge = market({
      collateralAsset: {
        symbol: 'cbDOGE',
        address: '0xcbD06E5A2B0C65597161de254AA074E489dEb510',
        decimals: 8,
      },
      supplyAssetsUsd: 500_000,
    });

    expect(isMainstreamBorrowMarket(cbDoge)).toBe(false);
  });

  test('includes SOL/USDC below global TVL floor', () => {
    const sol = market({
      collateralAsset: {
        symbol: 'SOL',
        address: '0x311935Cd80B76769bF2ecC9D8Ab7635b2139cf82',
        decimals: 9,
      },
      supplyAssetsUsd: 3_000_000,
    });

    expect(isMainstreamBorrowMarket(sol)).toBe(true);
  });

  test('includes cbXRP/USDC at default TVL floor', () => {
    const cbXrp = market({
      collateralAsset: {
        symbol: 'cbXRP',
        address: '0xcb585250f852C6c6bf90434AB21A00f02833a4af',
        decimals: 6,
      },
      supplyAssetsUsd: 10_000_000,
    });

    expect(isMainstreamBorrowMarket(cbXrp)).toBe(true);
  });
});
