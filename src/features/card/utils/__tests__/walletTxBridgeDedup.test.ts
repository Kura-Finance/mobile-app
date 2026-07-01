import { describe, expect, test } from 'vitest';
import type { WalletTx } from '../../hooks/useWalletHistory';
import { reconcileBridgeAndChainTxs } from '../walletTxBridgeDedup';

function tx(overrides: Partial<WalletTx> & Pick<WalletTx, 'id' | 'source'>): WalletTx {
  return {
    hash: '',
    timestamp: '2026-01-01T12:00:00.000Z',
    direction: 'in',
    counterparty: '0x1',
    counterpartyName: null,
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    tokenIconUrl: null,
    amount: 100,
    rawValue: '100',
    ...overrides,
  };
}

describe('reconcileBridgeAndChainTxs', () => {
  test('hides chain receive when hash matches a bridge fiat deposit', () => {
    const bridge = tx({
      id: 'fiat-deposit-1',
      source: 'fiat_deposit',
      hash: '0xbridge',
      amount: 0,
      statusPending: true,
      statusLabelKey: 'card.statusConverting',
    });
    const chain = tx({
      id: 'chain-1',
      source: 'chain',
      hash: '0xbridge',
      direction: 'in',
      amount: 49.62,
    });

    const result = reconcileBridgeAndChainTxs([bridge, chain]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('fiat-deposit-1');
    expect(result[0].amount).toBe(49.62);
  });

  test('matches by USDC amount when bridge hash is missing', () => {
    const bridge = tx({
      id: 'fiat-deposit-2',
      source: 'fiat_deposit',
      amount: 49.62,
      statusPending: false,
      statusLabelKey: 'card.statusCompleted',
      timestamp: '2026-01-01T11:00:00.000Z',
    });
    const chain = tx({
      id: 'chain-2',
      source: 'chain',
      hash: '0xsettlement',
      amount: 49.62,
      timestamp: '2026-01-01T12:00:00.000Z',
    });

    const result = reconcileBridgeAndChainTxs([bridge, chain]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('fiat_deposit');
    expect(result[0].hash).toBe('0xsettlement');
  });

  test('keeps unrelated chain transfers', () => {
    const bridge = tx({
      id: 'fiat-deposit-1',
      source: 'fiat_deposit',
      hash: '0xbridge',
      amount: 10,
    });
    const chain = tx({
      id: 'chain-1',
      source: 'chain',
      hash: '0xother',
      amount: 25,
    });

    const result = reconcileBridgeAndChainTxs([bridge, chain]);
    expect(result).toHaveLength(2);
  });
});
