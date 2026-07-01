import { describe, expect, test } from 'vitest';
import type { WalletTx } from '../../hooks/useWalletHistory';
import { promoteLikelyBridgeFiatFromChain } from '../walletTxBridgeInfer';

function chainTx(overrides: Partial<WalletTx> = {}): WalletTx {
  return {
    id: 'chain-1',
    source: 'chain',
    hash: '0xabc',
    timestamp: '2026-01-01T12:00:00.000Z',
    direction: 'in',
    counterparty: '0x4c2c00b8',
    counterpartyName: null,
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    tokenIconUrl: null,
    amount: 49.62,
    rawValue: '49620000',
    ...overrides,
  };
}

describe('promoteLikelyBridgeFiatFromChain', () => {
  test('promotes USDC receive when user has VA but deposit API is empty', () => {
    const result = promoteLikelyBridgeFiatFromChain([chainTx()], {
      userHasBridgeAccounts: true,
      apiDepositCount: 0,
    });
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('fiat_deposit');
    expect(result[0].amount).toBe(49.62);
  });

  test('does not promote when deposit API already returned rows', () => {
    const result = promoteLikelyBridgeFiatFromChain(
      [
        chainTx(),
        { ...chainTx(), id: 'fiat-1', source: 'fiat_deposit', amount: 49.62 },
      ],
      {
        userHasBridgeAccounts: true,
        apiDepositCount: 1,
      },
    );
    expect(result.some((tx) => tx.source === 'chain')).toBe(true);
  });

  test('does not promote without Bridge virtual accounts', () => {
    const result = promoteLikelyBridgeFiatFromChain([chainTx()], {
      userHasBridgeAccounts: false,
      apiDepositCount: 0,
    });
    expect(result[0].source).toBe('chain');
  });
});
