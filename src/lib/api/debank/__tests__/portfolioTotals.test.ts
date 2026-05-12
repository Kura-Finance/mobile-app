import { describe, expect, test } from 'vitest';
import {
  computeWalletPortfolioTotals,
  effectiveProtocolDisplayUsd,
  findLinkedProtocol,
  shouldCountTokenInSpotTotal,
  sumTokenTotalUsd,
  walletPortfolioTotalUsd,
} from '../portfolioTotals';
import type { DeBankProtocol, DeBankToken } from '../types';

function token(partial: Partial<DeBankToken> & Pick<DeBankToken, 'amount' | 'price'>): DeBankToken {
  return {
    id: partial.id ?? 'tok-1',
    symbol: partial.symbol ?? 'TOKEN',
    name: partial.name ?? 'Token',
    amount: partial.amount,
    price: partial.price,
    logo: partial.logo ?? '',
    chain: partial.chain ?? 'eth',
    protocolId: partial.protocolId ?? '',
    isWallet: partial.isWallet ?? true,
    cachedAt: partial.cachedAt ?? '2026-05-12T00:00:00Z',
  };
}

function protocol(
  partial: Partial<DeBankProtocol> & Pick<DeBankProtocol, 'id' | 'netUsdValue'>,
): DeBankProtocol {
  return {
    name: partial.name ?? 'Protocol',
    assetUsdValue: partial.assetUsdValue ?? partial.netUsdValue,
    debtUsdValue: partial.debtUsdValue ?? 0,
    chain: partial.chain ?? 'eth',
    logo: partial.logo ?? '',
    siteUrl: partial.siteUrl ?? '',
    portfolioItems: partial.portfolioItems ?? [],
    cachedAt: partial.cachedAt ?? '2026-05-12T00:00:00Z',
    ...partial,
  };
}

describe('portfolioTotals', () => {
  test('includes mint / receipt tokens in token total when protocol net is zero', () => {
    const tokens = [
      token({ id: 'eth_usdc', symbol: 'USDC', amount: 50, price: 1, protocolId: '' }),
      token({
        id: 'aave_ausdc',
        symbol: 'aUSDC',
        amount: 100,
        price: 1,
        protocolId: 'aave',
      }),
    ];

    expect(sumTokenTotalUsd(tokens)).toBe(150);
  });

  test('skips mint tokens when protocol net already counts the position', () => {
    const tokens = [
      token({ id: 'aave_ausdc', symbol: 'aUSDC', amount: 500, price: 1, protocolId: 'aave' }),
      token({ id: 'eth_usdc', symbol: 'USDC', amount: 25, price: 1, protocolId: '' }),
    ];
    const protocols = [protocol({ id: 'aave', netUsdValue: 500 })];

    expect(computeWalletPortfolioTotals(tokens, protocols)).toEqual({
      tokenTotalUsd: 25,
      protocolTotalUsd: 500,
      totalUsd: 525,
    });
  });

  test('morpho mint-only: counts receipt token, not protocol inner rows', () => {
    const tokens = [
      token({
        id: 'base_steakusdc',
        symbol: 'steakUSDC',
        amount: 2,
        price: 1,
        protocolId: 'morpho',
        chain: 'base',
      }),
      token({
        id: 'base_usdc',
        symbol: 'USDC',
        amount: 1.7679,
        price: 1,
        protocolId: '',
        chain: 'base',
      }),
    ];
    const protocols = [
      protocol({
        id: 'morpho-base',
        netUsdValue: 0,
        chain: 'base',
        portfolioItems: [
          {
            type: 'yield',
            usdValue: 2,
            tokens: [{ id: 'usdc', symbol: 'USDC', name: 'USDC', amount: 2, price: 1, usdValue: 2, logo: '' }],
          },
        ],
      }),
    ];

    expect(findLinkedProtocol(tokens[0]!, protocols)).toBe(protocols[0]);
    expect(shouldCountTokenInSpotTotal(tokens[0]!, protocols)).toBe(true);
    expect(computeWalletPortfolioTotals(tokens, protocols)).toEqual({
      tokenTotalUsd: 3.7679,
      protocolTotalUsd: 0,
      totalUsd: 3.7679,
    });
    expect(effectiveProtocolDisplayUsd(protocols[0]!)).toBe(2);
  });

  test('walletPortfolioTotalUsd adds token and protocol spot totals', () => {
    const tokens = [
      token({ amount: 100, price: 1, protocolId: 'morpho' }),
      token({ amount: 25, price: 1, protocolId: '' }),
    ];

    expect(walletPortfolioTotalUsd(sumTokenTotalUsd(tokens), 0)).toBe(125);
    expect(walletPortfolioTotalUsd(sumTokenTotalUsd(tokens), 500)).toBe(625);
  });
});
