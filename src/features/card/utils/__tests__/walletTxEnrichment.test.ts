import { describe, expect, test } from 'vitest';
import { enrichWalletActivities, LIFI_DIAMOND_BASE } from '../walletTxEnrichment';
import type { WalletTx } from '../../hooks/useWalletHistory';

function leg(
  overrides: Partial<WalletTx> & Pick<WalletTx, 'direction' | 'amount' | 'tokenSymbol'>,
): WalletTx {
  return {
    id: `${overrides.hash}-${overrides.tokenSymbol}-${overrides.direction}`,
    source: 'chain',
    hash: '0xhash1',
    timestamp: '2026-01-01T12:00:00.000Z',
    counterparty: '0xother',
    counterpartyName: null,
    tokenDecimals: 6,
    tokenIconUrl: null,
    rawValue: '0',
    ...overrides,
  };
}

describe('enrichWalletActivities', () => {
  test('splits Li.Fi USDC out + WETH in into two Buy legs', () => {
    const txs = enrichWalletActivities([
      leg({
        direction: 'out',
        amount: 50,
        tokenSymbol: 'USDC',
        toAddress: LIFI_DIAMOND_BASE,
        counterparty: LIFI_DIAMOND_BASE,
      }),
      leg({
        id: 'in-weth',
        direction: 'in',
        amount: 0.02,
        tokenSymbol: 'WETH',
        fromAddress: LIFI_DIAMOND_BASE,
        counterparty: LIFI_DIAMOND_BASE,
      }),
    ]);

    expect(txs).toHaveLength(2);
    const usdcLeg = txs.find((t) => t.tokenSymbol === 'USDC');
    const wethLeg = txs.find((t) => t.tokenSymbol === 'WETH');
    expect(usdcLeg?.activityKind).toBe('buy');
    expect(usdcLeg?.direction).toBe('out');
    expect(wethLeg?.activityKind).toBe('buy');
    expect(wethLeg?.direction).toBe('in');
    expect(wethLeg?.amount).toBe(0.02);
    expect(wethLeg?.activityDetailKey).toBe('card.txDetailLifiPair');
    expect(wethLeg?.activityDetailParams).toEqual({ from: 'USDC', to: 'WETH' });
  });

  test('splits WETH out + USDC in into two Sell legs', () => {
    const txs = enrichWalletActivities([
      leg({
        direction: 'out',
        amount: 0.02,
        tokenSymbol: 'WETH',
        toAddress: LIFI_DIAMOND_BASE,
        counterparty: LIFI_DIAMOND_BASE,
      }),
      leg({
        id: 'in-usdc',
        direction: 'in',
        amount: 49.5,
        tokenSymbol: 'USDC',
        fromAddress: LIFI_DIAMOND_BASE,
        counterparty: LIFI_DIAMOND_BASE,
      }),
    ]);

    expect(txs).toHaveLength(2);
    const wethLeg = txs.find((t) => t.tokenSymbol === 'WETH');
    const usdcLeg = txs.find((t) => t.tokenSymbol === 'USDC');
    expect(wethLeg?.activityKind).toBe('sell');
    expect(wethLeg?.direction).toBe('out');
    expect(usdcLeg?.activityKind).toBe('sell');
    expect(usdcLeg?.direction).toBe('in');
    expect(wethLeg?.amount).toBe(0.02);
  });

  test('labels plain send and receive', () => {
    const recipient = '0xabc0000000000000000000000000000000000123';
    const sender = '0xdef0000000000000000000000000000000000456';

    const txs = enrichWalletActivities([
      leg({
        hash: '0xsend',
        id: 'send',
        direction: 'out',
        amount: 10,
        tokenSymbol: 'USDC',
        counterparty: recipient,
        toAddress: recipient,
      }),
      leg({
        hash: '0xrecv',
        id: 'recv',
        direction: 'in',
        amount: 5,
        tokenSymbol: 'USDC',
        counterparty: sender,
        fromAddress: sender,
      }),
    ]);

    expect(txs).toHaveLength(2);
    expect(txs.find((t) => t.hash === '0xsend')?.activityKind).toBe('send');
    expect(txs.find((t) => t.hash === '0xrecv')?.activityKind).toBe('receive');
  });

  test('labels Li.Fi-only outflow as bridge', () => {
    const txs = enrichWalletActivities([
      leg({
        direction: 'out',
        amount: 100,
        tokenSymbol: 'USDC',
        toAddress: LIFI_DIAMOND_BASE,
        counterparty: LIFI_DIAMOND_BASE,
      }),
    ]);

    expect(txs).toHaveLength(1);
    expect(txs[0].activityKind).toBe('bridge_out');
  });
});

describe('shouldDisplayWalletTx bridge_out', () => {
  test('hides bridge-only Li.Fi outflows from history', async () => {
    const { shouldDisplayWalletTx } = await import('../walletTxFilter');
    expect(
      shouldDisplayWalletTx({
        id: 'bridge',
        source: 'chain',
        hash: '0x1',
        timestamp: '2026-01-01T12:00:00.000Z',
        direction: 'out',
        counterparty: LIFI_DIAMOND_BASE,
        counterpartyName: null,
        tokenSymbol: 'USDC',
        tokenDecimals: 6,
        tokenIconUrl: null,
        amount: 1,
        rawValue: '0',
        activityKind: 'bridge_out',
      }),
    ).toBe(false);
  });
});
