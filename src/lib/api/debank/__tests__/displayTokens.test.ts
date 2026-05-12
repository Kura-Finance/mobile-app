import { describe, expect, test } from 'vitest';
import {
  filterSpotTokensForDisplay,
  isNativeChainToken,
  shouldDisplaySpotToken,
} from '../displayTokens';
import type { DeBankToken } from '../types';

function makeToken(partial: Partial<DeBankToken> & Pick<DeBankToken, 'amount' | 'price'>): DeBankToken {
  return {
    id: partial.id ?? 'tok',
    symbol: partial.symbol ?? 'TOKEN',
    name: partial.name ?? 'Token',
    amount: partial.amount,
    price: partial.price,
    logo: '',
    chain: partial.chain ?? 'base',
    protocolId: '',
    isWallet: true,
    cachedAt: '2026-05-12T00:00:00Z',
    ...partial,
  };
}

describe('displayTokens', () => {
  test('detects Base native ETH', () => {
    expect(
      isNativeChainToken(makeToken({ id: 'base', symbol: 'ETH', chain: 'base', amount: 0.00005, price: 3000 })),
    ).toBe(true);
  });

  test('shows native ETH below the dust threshold', () => {
    const nativeEth = makeToken({ id: 'base', symbol: 'ETH', chain: 'base', amount: 0.00005, price: 3000 });
    expect(shouldDisplaySpotToken(nativeEth)).toBe(true);
    expect(filterSpotTokensForDisplay([nativeEth])).toHaveLength(1);
  });

  test('hides sub-cent dust but keeps USDC above threshold', () => {
    const dust = makeToken({ id: '0xabc', symbol: 'SHIB', chain: 'eth', amount: 1, price: 0.001 });
    const usdc = makeToken({ id: '0xusdc', symbol: 'USDC', chain: 'base', amount: 1.48, price: 1 });
    const visible = filterSpotTokensForDisplay([dust, usdc]);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.symbol).toBe('USDC');
  });

  test('does not treat WETH as native gas', () => {
    const weth = makeToken({
      id: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      chain: 'base',
      amount: 0.000001,
      price: 3000,
    });
    expect(isNativeChainToken(weth)).toBe(false);
    expect(shouldDisplaySpotToken(weth)).toBe(false);
  });
});
