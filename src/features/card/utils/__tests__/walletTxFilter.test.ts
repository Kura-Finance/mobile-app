import { describe, expect, test } from 'vitest';
import { shouldDisplayWalletTx } from '../walletTxFilter';
import type { WalletTx } from '../../hooks/useWalletHistory';

function chainTx(overrides: Partial<WalletTx> & Pick<WalletTx, 'amount' | 'tokenSymbol'>): WalletTx {
  return {
    id: '1',
    source: 'chain',
    hash: '0xabc',
    timestamp: new Date().toISOString(),
    direction: 'in',
    counterparty: '0x1',
    counterpartyName: null,
    tokenDecimals: 6,
    tokenIconUrl: null,
    rawValue: '0',
    ...overrides,
  };
}

describe('shouldDisplayWalletTx', () => {
  test('always shows bridge / fiat activity', () => {
    expect(
      shouldDisplayWalletTx({
        ...chainTx({ amount: 0.001, tokenSymbol: 'USDC' }),
        source: 'fiat_deposit',
      }),
    ).toBe(true);
  });

  test('hides sub-cent USDC dust', () => {
    expect(shouldDisplayWalletTx(chainTx({ amount: 0.001, tokenSymbol: 'USDC' }))).toBe(false);
    expect(shouldDisplayWalletTx(chainTx({ amount: 0.02, tokenSymbol: 'USDC' }))).toBe(true);
  });

  test('hides unknown incoming airdrop spam at any amount', () => {
    expect(
      shouldDisplayWalletTx(chainTx({ amount: 0.5, tokenSymbol: 'SCAMCOIN', direction: 'in' })),
    ).toBe(false);
    expect(
      shouldDisplayWalletTx(chainTx({ amount: 25, tokenSymbol: 'Gucci', direction: 'in' })),
    ).toBe(false);
    expect(
      shouldDisplayWalletTx(chainTx({ amount: 1000, tokenSymbol: 'USA', direction: 'in' })),
    ).toBe(false);
  });

  test('shows known stablecoin incoming above dust floor', () => {
    expect(shouldDisplayWalletTx(chainTx({ amount: 5, tokenSymbol: 'USDC', direction: 'in' }))).toBe(true);
  });

  test('hides small unknown outgoing transfers', () => {
    expect(
      shouldDisplayWalletTx(chainTx({ amount: 0.5, tokenSymbol: 'SCAMCOIN', direction: 'out' })),
    ).toBe(false);
  });
});
