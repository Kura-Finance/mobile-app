import { describe, expect, test } from 'vitest';
import {
  normalizeDeBankProtocol,
  normalizeDeBankToken,
  normalizeEvmAddress,
} from '../normalize';

describe('normalizeEvmAddress', () => {
  test('lowercases and trims a valid 0x40-hex address', () => {
    expect(normalizeEvmAddress('  0xAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  ')).toBe(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
  });

  test('rejects non-hex characters', () => {
    expect(() => normalizeEvmAddress('0xZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ')).toThrow();
  });

  test('rejects wrong length', () => {
    expect(() => normalizeEvmAddress('0x1234')).toThrow();
    expect(() => normalizeEvmAddress('1234567890123456789012345678901234567890')).toThrow();
  });
});

describe('normalizeDeBankToken', () => {
  test('extracts symbol/amount/price/chain/logo from canonical fields', () => {
    const out = normalizeDeBankToken({
      rawData: {
        id: 'tok-1',
        symbol: 'eth',
        optimized_symbol: 'ETH',
        name: 'Ethereum',
        amount: 1.5,
        price: 3000,
        chain: 'eth',
        logo_url: 'https://logos.example/eth.png',
      },
      symbol: 'ETH',
      chain: 'eth',
      tokenId: 'tok-fallback',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out).toEqual({
      id: 'tok-1',
      symbol: 'ETH',
      name: 'Ethereum',
      amount: 1.5,
      price: 3000,
      chain: 'eth',
      logo: 'https://logos.example/eth.png',
      protocolId: '',
      isWallet: true,
      cachedAt: '2026-05-12T00:00:00Z',
    });
  });

  test('falls back to tokenId / synthetic id when upstream omits id', () => {
    const out = normalizeDeBankToken({
      rawData: { symbol: 'USDC', amount: 100, price: 1 },
      symbol: 'USDC',
      chain: 'eth',
      tokenId: 'tok-fallback',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out?.id).toBe('tok-fallback');
  });

  test('uses string-number coercion for sloppy upstream values', () => {
    const out = normalizeDeBankToken({
      rawData: { symbol: 'USDC', amount: '12.34', price: '0.99' },
      symbol: 'USDC',
      chain: 'eth',
      tokenId: 'x',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out?.amount).toBe(12.34);
    expect(out?.price).toBe(0.99);
  });

  test('returns null for non-object payload', () => {
    expect(
      normalizeDeBankToken({
        rawData: 'oops',
        symbol: 'X',
        chain: 'eth',
        tokenId: 'x',
        cachedAt: '2026-05-12T00:00:00Z',
      }),
    ).toBeNull();
  });
});

describe('normalizeDeBankProtocol', () => {
  test('extracts assets from portfolio_item_list.token_list', () => {
    const out = normalizeDeBankProtocol({
      rawData: {
        id: 'uniswap',
        name: 'Uniswap V3',
        chain: 'eth',
        stats: { net_usd_value: 12500 },
        logo_url: 'https://logos.example/uniswap.png',
        portfolio_item_list: [
          {
            name: 'Liquidity',
            token_list: [
              { symbol: 'ETH', amount: 1, price: 3000 },
              { symbol: 'USDC', amount: 3000, price: 1 },
            ],
          },
        ],
      },
      protocolId: 'p1',
      chain: 'eth',
      cachedAt: '2026-05-12T00:00:00Z',
    });

    expect(out?.name).toBe('Uniswap V3');
    expect(out?.netUsdValue).toBe(12500);
    expect(out?.chain).toBe('eth');
    expect(out?.portfolioItems).toHaveLength(1);
    expect(out?.portfolioItems[0].tokens).toHaveLength(2);
    expect(out?.portfolioItems[0].tokens.map((a) => a.symbol).sort()).toEqual(['ETH', 'USDC']);
  });

  test('preserves portfolio item net_usd_value without summing tokens', () => {
    const out = normalizeDeBankProtocol({
      rawData: {
        name: 'StakedETH',
        chain: 'eth',
        net_usd_value: 5000,
        portfolio_item_list: [
          {
            name: 'Bond',
            stats: { net_usd_value: 9999 },
          },
        ],
      },
      protocolId: 'p1',
      chain: 'eth',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out?.netUsdValue).toBe(5000);
    expect(out?.portfolioItems).toHaveLength(1);
    expect(out?.portfolioItems[0].usdValue).toBe(9999);
    expect(out?.portfolioItems[0].tokens).toHaveLength(0);
  });

  test('extracts tokens from portfolio_item_list.token_list', () => {
    const out = normalizeDeBankProtocol({
      rawData: {
        name: 'Aave',
        chain: 'eth',
        net_usd_value: 200,
        portfolio_item_list: [
          {
            name: 'Lending',
            stats: { net_usd_value: 200 },
            token_list: [{ symbol: 'WBTC', amount: 0.001, price: 70000 }],
          },
        ],
      },
      protocolId: 'p1',
      chain: 'eth',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out?.portfolioItems).toHaveLength(1);
    expect(out?.portfolioItems[0].tokens[0].symbol).toBe('WBTC');
    expect(out?.portfolioItems[0].tokens[0].usdValue).toBeCloseTo(70);
  });

  test('returns null for non-object rawData', () => {
    expect(
      normalizeDeBankProtocol({
        rawData: null,
        protocolId: 'x',
        chain: 'eth',
        cachedAt: '2026-05-12T00:00:00Z',
      }),
    ).toBeNull();
  });

  test('derives a stable id when upstream omits one', () => {
    const out = normalizeDeBankProtocol({
      rawData: { name: 'My Protocol' },
      protocolId: '',
      chain: 'eth',
      cachedAt: '2026-05-12T00:00:00Z',
    });
    expect(out?.id).toBe('my-protocol');
  });

  test('dedupes identical USDC from token_list and supply_token_list', () => {
    const out = normalizeDeBankProtocol({
      rawData: {
        id: 'morpho',
        name: 'Morpho',
        chain: 'base',
        net_usd_value: 1000,
        portfolio_item_list: [
          {
            name: 'Lending',
            stats: { net_usd_value: 1000 },
            token_list: [
              { id: 'base_usdc', symbol: 'USDC', amount: 1000, price: 1, usd_value: 1000 },
            ],
            supply_token_list: [
              { id: 'base_usdc', symbol: 'USDC', amount: 1000, price: 1, usd_value: 1000 },
            ],
          },
        ],
      },
      protocolId: 'morpho-base',
      chain: 'base',
      cachedAt: '2026-05-12T00:00:00Z',
    });

    expect(out?.portfolioItems[0]?.tokens).toHaveLength(1);
    expect(out?.portfolioItems[0]?.tokens[0]?.symbol).toBe('USDC');
    expect(out?.portfolioItems[0]?.tokens[0]?.amount).toBe(1000);
  });

  test('keeps separate supply and reward tokens with the same symbol', () => {
    const out = normalizeDeBankProtocol({
      rawData: {
        name: 'Aave',
        portfolio_item_list: [
          {
            name: 'Lending',
            detail: {
              supply_token_list: [
                { id: 'eth_usdc', symbol: 'USDC', amount: 100, price: 1, usd_value: 100 },
              ],
              reward_token_list: [
                { id: 'eth_usdc', symbol: 'USDC', amount: 2, price: 1, usd_value: 2 },
              ],
            },
          },
        ],
      },
      protocolId: 'aave',
      chain: 'eth',
      cachedAt: '2026-05-12T00:00:00Z',
    });

    expect(out?.portfolioItems[0]?.tokens).toHaveLength(2);
    expect(out?.portfolioItems[0]?.tokens.map((t) => t.amount).sort((a, b) => a - b)).toEqual([2, 100]);
  });

  test('keeps protocol net_usd_value even when upstream reports zero', () => {
    const out = normalizeDeBankProtocol({
      rawData: {
        id: 'morpho',
        name: 'Morpho',
        chain: 'base',
        net_usd_value: 0,
        stats: { net_usd_value: 0, asset_usd_value: 0 },
        portfolio_item_list: [
          {
            name: 'Position',
            stats: { net_usd_value: 1 },
            supply_token_list: [{ symbol: 'USDC', amount: 1, price: 1, usd_value: 1 }],
          },
        ],
      },
      protocolId: 'morpho-base',
      chain: 'base',
      cachedAt: '2026-05-12T00:00:00Z',
    });

    expect(out?.netUsdValue).toBe(0);
    expect(out?.portfolioItems[0]?.usdValue).toBe(1);
    expect(out?.portfolioItems[0]?.tokens[0]?.usdValue).toBe(1);
  });
});
