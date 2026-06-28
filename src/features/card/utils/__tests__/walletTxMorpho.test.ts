import { describe, expect, test } from 'vitest';
import type { WalletTx } from '../../hooks/useWalletHistory';
import { classifyMorphoActivities, MORPHO_BLUE_ADDRESS } from '../walletTxMorpho';
import { enrichWalletActivities } from '../walletTxEnrichment';

const MORPHO = MORPHO_BLUE_ADDRESS;
const EARN_VAULT = '0x0F457aa0AfD3D208cbfEE520804118f88965a529';

function leg(
  overrides: Partial<WalletTx> & Pick<WalletTx, 'direction' | 'amount' | 'tokenSymbol'>,
): WalletTx {
  return {
    id: `${overrides.hash ?? '0xhash'}-${overrides.tokenSymbol}-${overrides.direction}`,
    source: 'chain',
    hash: '0xhash',
    timestamp: '2026-01-01T12:00:00.000Z',
    counterparty: '0xother',
    counterpartyName: null,
    tokenDecimals: 6,
    tokenIconUrl: null,
    rawValue: '0',
    ...overrides,
  };
}

describe('classifyMorphoActivities', () => {
  test('classifies USDC borrow', () => {
    const { activities } = classifyMorphoActivities([
      leg({
        direction: 'in',
        amount: 500,
        tokenSymbol: 'USDC',
        fromAddress: MORPHO,
        counterparty: MORPHO,
      }),
    ]);

    expect(activities).toHaveLength(1);
    expect(activities[0].activityKind).toBe('borrow');
    expect(activities[0].tokenSymbol).toBe('USDC');
    expect(activities[0].amount).toBe(500);
  });

  test('classifies USDC repay', () => {
    const { activities } = classifyMorphoActivities([
      leg({
        direction: 'out',
        amount: 200,
        tokenSymbol: 'USDC',
        toAddress: MORPHO,
        counterparty: MORPHO,
      }),
    ]);

    expect(activities).toHaveLength(1);
    expect(activities[0].activityKind).toBe('repay');
  });

  test('classifies collateral deposit', () => {
    const { activities } = classifyMorphoActivities([
      leg({
        direction: 'out',
        amount: 0.5,
        tokenSymbol: 'WETH',
        toAddress: MORPHO,
        counterparty: MORPHO,
      }),
    ]);

    expect(activities).toHaveLength(1);
    expect(activities[0].activityKind).toBe('deposit');
    expect(activities[0].activitySubkind).toBe('borrow_collateral');
  });

  test('classifies collateral withdraw', () => {
    const { activities } = classifyMorphoActivities([
      leg({
        direction: 'in',
        amount: 0.1,
        tokenSymbol: 'CBBTC',
        fromAddress: MORPHO,
        counterparty: MORPHO,
      }),
    ]);

    expect(activities).toHaveLength(1);
    expect(activities[0].activityKind).toBe('withdraw');
    expect(activities[0].activitySubkind).toBe('borrow_collateral');
  });

  test('collapses borrow + collateral supply into one borrow row', () => {
    const { activities } = classifyMorphoActivities([
      leg({
        id: 'out-weth',
        direction: 'out',
        amount: 0.5,
        tokenSymbol: 'WETH',
        toAddress: MORPHO,
        counterparty: MORPHO,
      }),
      leg({
        id: 'in-usdc',
        direction: 'in',
        amount: 800,
        tokenSymbol: 'USDC',
        fromAddress: MORPHO,
        counterparty: MORPHO,
      }),
    ]);

    expect(activities).toHaveLength(1);
    expect(activities[0].activityKind).toBe('borrow');
    expect(activities[0].tokenSymbol).toBe('USDC');
    expect(activities[0].activityDetailKey).toBe('card.txDetailMorphoBorrowWithCollateral');
  });

  test('classifies earn deposit and withdraw', () => {
    const deposit = classifyMorphoActivities([
      leg({
        direction: 'out',
        amount: 1000,
        tokenSymbol: 'USDC',
        toAddress: EARN_VAULT,
        counterparty: EARN_VAULT,
      }),
    ]);
    expect(deposit.activities[0].activityKind).toBe('deposit');
    expect(deposit.activities[0].activitySubkind).toBe('earn');

    const withdraw = classifyMorphoActivities([
      leg({
        direction: 'in',
        amount: 500,
        tokenSymbol: 'USDC',
        fromAddress: EARN_VAULT,
        counterparty: EARN_VAULT,
      }),
    ]);
    expect(withdraw.activities[0].activityKind).toBe('withdraw');
    expect(withdraw.activities[0].activitySubkind).toBe('earn');
  });
});

describe('enrichWalletActivities morpho', () => {
  test('does not mislabel morpho borrow as sell', () => {
    const txs = enrichWalletActivities([
      leg({
        direction: 'out',
        amount: 0.5,
        tokenSymbol: 'WETH',
        toAddress: MORPHO,
        counterparty: MORPHO,
      }),
      leg({
        id: 'in-usdc',
        direction: 'in',
        amount: 800,
        tokenSymbol: 'USDC',
        fromAddress: MORPHO,
        counterparty: MORPHO,
      }),
    ]);

    expect(txs).toHaveLength(1);
    expect(txs[0].activityKind).toBe('borrow');
    expect(txs[0].activityKind).not.toBe('sell');
  });
});
