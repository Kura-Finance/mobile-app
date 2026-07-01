import { describe, expect, test } from 'vitest';
import { computeDefiAllocationBuckets } from '../defiAllocation';
import type { DefiProtocol, DefiToken, WalletData } from '../../hooks/useDefiPortfolio';

function spotToken(partial: Partial<DefiToken> & Pick<DefiToken, 'symbol' | 'usdValue'>): DefiToken {
  return {
    id: partial.id ?? '1',
    chain: partial.chain ?? 'base',
    name: partial.name ?? partial.symbol,
    logoUrl: null,
    price: 1,
    amount: partial.usdValue,
    isVerified: true,
    protocolId: partial.protocolId ?? '',
    ...partial,
  };
}

function defiProtocol(partial: Partial<DefiProtocol> & Pick<DefiProtocol, 'id' | 'netUsdValue'>): DefiProtocol {
  return {
    name: partial.name ?? 'Protocol',
    chain: partial.chain ?? 'base',
    logoUrl: null,
    siteUrl: null,
    assetUsdValue: partial.assetUsdValue ?? partial.netUsdValue,
    debtUsdValue: partial.debtUsdValue ?? 0,
    portfolioItems: partial.portfolioItems ?? [],
    ...partial,
  };
}

function wallet(partial: Partial<WalletData> & Pick<WalletData, 'address'>): WalletData {
  return {
    label: undefined,
    tokenTotalUsdValue: 0,
    protocolTotalUsdValue: 0,
    tokens: partial.tokens ?? [],
    protocols: partial.protocols ?? [],
    isLoading: false,
    error: null,
    ...partial,
  };
}

describe('computeDefiAllocationBuckets', () => {
  test('wallet spot: stablecoins vs crypto vs protocol yield', () => {
    const rows = [
      wallet({
        address: '0x1',
        tokens: [
          spotToken({ symbol: 'USDC', usdValue: 100 }),
          spotToken({ symbol: 'ETH', usdValue: 200 }),
          spotToken({ symbol: 'LINK', usdValue: 50 }),
          spotToken({ symbol: 'aUSDC', usdValue: 500, protocolId: 'aave' }),
        ],
        protocols: [defiProtocol({ id: 'aave', netUsdValue: 500 })],
      }),
    ];

    expect(computeDefiAllocationBuckets(rows, 850)).toEqual({
      stablecoins: 100,
      crypto: 250,
      yield: 500,
      other: 0,
    });
  });

  test('protocol-linked receipt token excluded from crypto when protocol net is set', () => {
    const rows = [
      wallet({
        address: '0x1',
        tokens: [
          spotToken({ symbol: 'steakUSDC', usdValue: 300, protocolId: 'morpho' }),
        ],
        protocols: [defiProtocol({ id: 'morpho', netUsdValue: 300 })],
      }),
    ];

    expect(computeDefiAllocationBuckets(rows, 300)).toEqual({
      stablecoins: 0,
      crypto: 0,
      yield: 300,
      other: 0,
    });
  });

  test('KGTUSDCF vault share excluded from token buckets when morpho protocol covers it', () => {
    const rows = [
      wallet({
        address: '0x1',
        tokens: [
          spotToken({ symbol: 'KGTUSDCF', usdValue: 0.01, protocolId: 'morpho-base' }),
          spotToken({ symbol: 'USDC', usdValue: 5 }),
        ],
        protocols: [
          defiProtocol({
            id: 'morpho-base',
            netUsdValue: 0.01,
            portfolioItems: [
              {
                type: 'yield',
                usdValue: 0.01,
                tokens: [{ symbol: 'USDC', amount: 0.01, usdValue: 0.01, logoUrl: null }],
              },
            ],
          }),
        ],
      }),
    ];

    expect(computeDefiAllocationBuckets(rows, 5.01)).toEqual({
      stablecoins: 5,
      crypto: 0,
      yield: 0.01,
      other: 0,
    });
  });
});
