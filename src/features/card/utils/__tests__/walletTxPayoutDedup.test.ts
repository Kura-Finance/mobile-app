import { describe, expect, test } from 'vitest';
import type { WalletTx } from '../../hooks/useWalletHistory';
import type { PayoutAddressResult } from '../../../../lib/api/ramp/client';
import { reconcilePayoutAndChainTxs } from '../walletTxPayoutDedup';

function tx(overrides: Partial<WalletTx> & Pick<WalletTx, 'id' | 'source'>): WalletTx {
  return {
    hash: '',
    timestamp: '2026-01-01T12:00:00.000Z',
    direction: 'out',
    counterparty: '0xla',
    counterpartyName: null,
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    tokenIconUrl: null,
    amount: 100,
    rawValue: '100',
    ...overrides,
  };
}

const payoutAddress: PayoutAddressResult = {
  bridgeLiquidationAddressId: 'la_1',
  depositAddress: '0xPayoutLa',
  sourceChain: 'base',
  sourceCurrency: 'usdc',
  destinationRail: 'wire',
  destinationCurrency: 'usd',
  bridgeExternalAccountId: 'ea_1',
};

describe('reconcilePayoutAndChainTxs', () => {
  test('hides chain send when hash matches a payout drain', () => {
    const payout = tx({
      id: 'fiat-withdraw-1',
      source: 'fiat_withdraw',
      hash: '0xpayout',
      amount: 100,
      statusPending: true,
      statusLabelKey: 'card.statusConverting',
      toAddress: '0xPayoutLa',
    });
    const chain = tx({
      id: 'chain-1',
      source: 'chain',
      hash: '0xpayout',
      direction: 'out',
      toAddress: '0xPayoutLa',
      amount: 100,
    });

    const result = reconcilePayoutAndChainTxs([payout, chain], [payoutAddress]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('fiat-withdraw-1');
    expect(result[0].source).toBe('fiat_withdraw');
  });

  test('promotes chain send to payout LA before drain appears', () => {
    const chain = tx({
      id: 'chain-2',
      source: 'chain',
      hash: '0xsend',
      direction: 'out',
      toAddress: '0xPayoutLa',
      amount: 50,
    });

    const result = reconcilePayoutAndChainTxs([chain], [payoutAddress]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('fiat_withdraw');
    expect(result[0].statusLabelKey).toBe('card.payoutStatusAwaitingBridge');
    expect(result[0].hash).toBe('0xsend');
  });

  test('keeps unrelated chain sends', () => {
    const chain = tx({
      id: 'chain-3',
      source: 'chain',
      hash: '0xother',
      direction: 'out',
      toAddress: '0xRandom',
      amount: 25,
    });

    const result = reconcilePayoutAndChainTxs([chain], [payoutAddress]);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('chain');
  });

  test('merges inferred row into api drain when both exist for same payout', () => {
    const chain = tx({
      id: 'chain-4',
      source: 'chain',
      hash: '0xsend100',
      direction: 'out',
      toAddress: '0xPayoutLa',
      amount: 100,
      timestamp: '2026-01-01T12:00:00.000Z',
    });
    const apiDrain = tx({
      id: 'fiat-withdraw-la_1:drain_1',
      source: 'fiat_withdraw',
      hash: '0xsend100',
      amount: 0,
      statusPending: true,
      statusLabelKey: 'card.statusConverting',
      toAddress: '0xPayoutLa',
      timestamp: '2026-01-01T12:05:00.000Z',
    });
    const inferred = tx({
      id: 'fiat-withdraw-inferred-0xsend100',
      source: 'fiat_withdraw',
      hash: '0xsend100',
      amount: 100,
      statusPending: true,
      statusLabelKey: 'card.payoutStatusAwaitingBridge',
      toAddress: '0xPayoutLa',
      timestamp: '2026-01-01T12:00:00.000Z',
    });

    const result = reconcilePayoutAndChainTxs([apiDrain, inferred, chain], [payoutAddress]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('fiat-withdraw-la_1:drain_1');
    expect(result[0].amount).toBe(100);
    expect(result[0].statusLabelKey).toBe('card.statusConverting');
  });

  test('uses chain USDC when drain amount is a tiny fiat/fee value', () => {
    const chain = tx({
      id: 'chain-5',
      source: 'chain',
      hash: '0xsend100',
      direction: 'out',
      toAddress: '0xPayoutLa',
      amount: 100,
      timestamp: '2026-01-01T12:00:00.000Z',
    });
    const apiDrain = tx({
      id: 'fiat-withdraw-la_1:drain_2',
      source: 'fiat_withdraw',
      hash: '',
      amount: 0.00242,
      statusPending: true,
      statusLabelKey: 'card.statusConverting',
      toAddress: '0xPayoutLa',
      timestamp: '2026-01-01T12:05:00.000Z',
    });

    const result = reconcilePayoutAndChainTxs([apiDrain, chain], [payoutAddress]);
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(100);
  });

  test('picks LA transfer leg over gas leg sharing the same user-op hash', () => {
    const gasLeg = tx({
      id: 'chain-gas',
      source: 'chain',
      hash: '0xuserop',
      direction: 'out',
      toAddress: '0xPaymaster',
      amount: 0.00242,
      timestamp: '2026-01-01T12:00:00.000Z',
    });
    const transferLeg = tx({
      id: 'chain-transfer',
      source: 'chain',
      hash: '0xuserop',
      direction: 'out',
      toAddress: '0xPayoutLa',
      amount: 100,
      timestamp: '2026-01-01T12:00:00.000Z',
    });
    const apiDrain = tx({
      id: 'fiat-withdraw-la_1:drain_3',
      source: 'fiat_withdraw',
      hash: '0xuserop',
      amount: 0.00242,
      statusPending: true,
      statusLabelKey: 'card.statusConverting',
      toAddress: '0xPayoutLa',
      timestamp: '2026-01-01T12:05:00.000Z',
    });

    const result = reconcilePayoutAndChainTxs(
      [apiDrain, gasLeg, transferLeg],
      [payoutAddress],
    );
    expect(result).toHaveLength(1);
    expect(result[0].amount).toBe(100);
  });
});
