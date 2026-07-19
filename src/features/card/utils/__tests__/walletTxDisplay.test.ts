import { describe, expect, test } from 'vitest';
import {
  formatTxListAmount,
  formatTxProcessedWith,
  getTxSubtitleLines,
  getTxRecipientDisplay,
  getTxIconKind,
  getTxTypeLabel,
  getTxUsdValue,
  isUsdPeggedSymbol,
  resolveAddressDisplay,
  shouldShowTxTokenQuantity,
} from '../walletTxDisplay';
import type { WalletTx } from '../../hooks/useWalletHistory';
import { LIFI_DIAMOND_BASE } from '../walletTxEnrichment';
import { MORPHO_BLUE_ADDRESS } from '../walletTxMorpho';

function tx(overrides: Partial<WalletTx> & Pick<WalletTx, 'direction'>): WalletTx {
  return {
    id: '1',
    source: 'chain',
    hash: '0xabc',
    timestamp: '2026-01-01T12:00:00.000Z',
    counterparty: '0x0000000000000000000000000000000000000123',
    counterpartyName: null,
    tokenSymbol: 'USDC',
    tokenDecimals: 6,
    tokenIconUrl: null,
    amount: 10,
    rawValue: '0',
    ...overrides,
  };
}

describe('getTxIconKind', () => {
  test('maps buy sell deposit borrow to dedicated icons', () => {
    expect(getTxIconKind(tx({ activityKind: 'buy', direction: 'in' }))).toBe('buy');
    expect(getTxIconKind(tx({ activityKind: 'sell', direction: 'out' }))).toBe('sell');
    expect(getTxIconKind(tx({ activityKind: 'deposit', direction: 'out' }))).toBe('deposit');
    expect(getTxIconKind(tx({ activityKind: 'borrow', direction: 'in' }))).toBe('borrow');
    expect(getTxIconKind(tx({ source: 'fiat_deposit', direction: 'in' }))).toBe('deposit');
    expect(getTxIconKind(tx({ activityKind: 'send', direction: 'out' }))).toBeNull();
  });
});

describe('getTxTypeLabel', () => {
  test('maps activity kinds to intent labels', () => {
    expect(getTxTypeLabel(tx({ activityKind: 'receive', direction: 'in' }))).toBe('Received');
    expect(getTxTypeLabel(tx({ activityKind: 'send', direction: 'out' }))).toBe('Sent');
    expect(getTxTypeLabel(tx({ activityKind: 'swap', direction: 'self' }))).toBe('Converted');
    expect(getTxTypeLabel(tx({ activityKind: 'buy', direction: 'in', tokenSymbol: 'WETH' }))).toBe(
      'Buy WETH',
    );
    expect(getTxTypeLabel(tx({ activityKind: 'buy', direction: 'out', tokenSymbol: 'USDC' }))).toBe(
      'Buy USDC',
    );
    expect(
      getTxTypeLabel(
        tx({
          activityKind: 'buy',
          direction: 'out',
          tokenSymbol: 'USDC',
          swapFromSymbol: 'USDC',
          swapToSymbol: 'WETH',
        }),
      ),
    ).toBe('Buy WETH');
    expect(getTxTypeLabel(tx({ activityKind: 'sell', direction: 'out', tokenSymbol: 'ETH' }))).toBe(
      'Sell ETH',
    );
    expect(getTxTypeLabel(tx({ activityKind: 'borrow', direction: 'in', tokenSymbol: 'USDC' }))).toBe(
      'Borrowed',
    );
    expect(getTxTypeLabel(tx({ activityKind: 'repay', direction: 'out', tokenSymbol: 'USDC' }))).toBe(
      'Repaid',
    );
    expect(getTxTypeLabel(tx({
      activityKind: 'deposit',
      activitySubkind: 'earn',
      direction: 'out',
      tokenSymbol: 'USDC',
    }))).toBe('Deposited');
    expect(getTxTypeLabel(tx({
      activityKind: 'withdraw',
      activitySubkind: 'borrow_collateral',
      direction: 'in',
      tokenSymbol: 'WETH',
    }))).toBe('Withdrawn');
  });

  test('labels bridge fiat and crypto deposits distinctly', () => {
    expect(getTxTypeLabel(tx({ source: 'fiat_deposit', direction: 'in' }))).toBe('Fiat deposit');
    expect(getTxTypeLabel(tx({ source: 'crypto_deposit', direction: 'in' }))).toBe('Crypto deposit');
  });
});

describe('getTxUsdValue', () => {
  test('treats USDC amount as USD', () => {
    expect(getTxUsdValue(tx({ direction: 'out', amount: 100, tokenSymbol: 'USDC' }))).toBe(100);
  });

  test('fiat on-ramp uses credited USDC when Bridge provides it', () => {
    expect(
      getTxUsdValue(
        tx({
          source: 'fiat_deposit',
          direction: 'in',
          amount: 462.5,
          tokenSymbol: 'USDC',
          sourceFiatAmount: 1_800_000,
          sourceFiatCurrency: 'COP',
        }),
      ),
    ).toBe(462.5);
  });

  test('fiat on-ramp converts COP source fiat when USDC amount is missing', () => {
    expect(
      getTxUsdValue(
        tx({
          source: 'fiat_deposit',
          direction: 'in',
          amount: 0,
          tokenSymbol: 'USDC',
          sourceFiatAmount: 1_800_000,
          sourceFiatCurrency: 'COP',
        }),
      ),
    ).toBeCloseTo(1_800_000 / 4100, 1);
  });
});

describe('formatTxProcessedWith', () => {
  test('shows source fiat for on-ramp deposits', () => {
    const label = formatTxProcessedWith(
      tx({
        source: 'fiat_deposit',
        direction: 'in',
        amount: 462.5,
        tokenSymbol: 'USDC',
        sourceFiatAmount: 1_800_000,
        sourceFiatCurrency: 'COP',
      }),
    );
    expect(label).toBe('1,800,000 COP');
  });
});

describe('shouldShowTxTokenQuantity', () => {
  test('shows token qty for buy/sell non-stable assets', () => {
    expect(
      shouldShowTxTokenQuantity(tx({ activityKind: 'buy', direction: 'in', tokenSymbol: 'WETH' })),
    ).toBe(true);
    expect(
      shouldShowTxTokenQuantity(tx({ activityKind: 'sell', direction: 'out', tokenSymbol: 'ETH' })),
    ).toBe(true);
  });

  test('uses fiat for buy/sell stablecoins', () => {
    expect(
      shouldShowTxTokenQuantity(tx({ activityKind: 'buy', direction: 'in', tokenSymbol: 'USDC' })),
    ).toBe(false);
  });

  test('uses fiat for receive/send', () => {
    expect(
      shouldShowTxTokenQuantity(tx({ activityKind: 'receive', direction: 'in', tokenSymbol: 'WETH' })),
    ).toBe(false);
  });
});

describe('formatTxListAmount', () => {
  test('formats buy crypto as token quantity with unit', () => {
    const label = formatTxListAmount(
      tx({ activityKind: 'buy', direction: 'in', tokenSymbol: 'WETH', amount: 0.02 }),
      (v) => `$${v.toFixed(2)}`,
    );
    expect(label).toBe('+0.0200 WETH');
  });

  test('formats sell crypto as negative token quantity', () => {
    const label = formatTxListAmount(
      tx({ activityKind: 'sell', direction: 'out', tokenSymbol: 'WETH', amount: -0.5 }),
      (v) => `$${v.toFixed(2)}`,
    );
    expect(label).toBe('−0.5000 WETH');
  });

  test('formats buy USDC leg as negative fiat', () => {
    const label = formatTxListAmount(
      tx({ activityKind: 'buy', direction: 'out', tokenSymbol: 'USDC', amount: 50 }),
      (v) => `$${v.toFixed(2)}`,
    );
    expect(label).toBe('−$50.00');
  });

  test('formats USDC buy token leg as positive fiat', () => {
    const label = formatTxListAmount(
      tx({ activityKind: 'buy', direction: 'in', tokenSymbol: 'USDC', amount: 50 }),
      (v) => `$${v.toFixed(2)}`,
    );
    expect(label).toBe('+$50.00');
  });
});

describe('isUsdPeggedSymbol', () => {
  test('recognizes stablecoin symbols', () => {
    expect(isUsdPeggedSymbol('usdc')).toBe(true);
    expect(isUsdPeggedSymbol('EURC')).toBe(true);
    expect(isUsdPeggedSymbol('WETH')).toBe(false);
  });
});

describe('getTxSubtitleLines', () => {
  test('uses contact name when address is saved', () => {
    const recipient = '0xabc0000000000000000000000000000000000123';
    const lines = getTxSubtitleLines(
      tx({
        activityKind: 'send',
        direction: 'out',
        counterparty: recipient,
        toAddress: recipient,
      }),
      [{ name: 'Alice', address: recipient }],
    );
    expect(lines.primary).toBe('Alice');
    expect(lines.secondary).toBeUndefined();
  });

  test('shows external wallet with address below', () => {
    const addr = '0xabc0000000000000000000000000000000000456';
    const lines = getTxSubtitleLines(
      tx({
        activityKind: 'send',
        direction: 'out',
        counterparty: addr,
        toAddress: addr,
      }),
      [],
    );
    expect(lines.primary).toBe('External wallet');
    expect(lines.secondary).toBe('0xabc0…0456');
  });

  test('shows swap pair subtitle for consolidated swaps', () => {
    const lines = getTxSubtitleLines(
      tx({
        activityKind: 'buy',
        direction: 'in',
        tokenSymbol: 'WETH',
        swapFromSymbol: 'USDC',
        swapToSymbol: 'WETH',
      }),
      [],
    );
    expect(lines.primary).toBe('USDC → Ethereum');
  });

  test('hides router address for Li.Fi receive', () => {
    const lines = getTxSubtitleLines(
      tx({
        activityKind: 'receive',
        direction: 'in',
        tokenSymbol: 'USDC',
        counterparty: LIFI_DIAMOND_BASE,
        fromAddress: LIFI_DIAMOND_BASE,
      }),
      [],
    );
    expect(lines.primary).toBe('USDC');
  });

  test('shows fiat rail and bridge status for pending on-ramp deposits', () => {
    const lines = getTxSubtitleLines(
      tx({
        source: 'fiat_deposit',
        direction: 'in',
        statusLabelKey: 'card.statusConverting',
        sourceFiatAmount: 1500,
        sourceFiatCurrency: 'MXN',
      }),
      [],
    );
    expect(lines.primary).toBe('Bank transfer');
    expect(lines.secondary).toBe('Converting');
  });

  test('shows payment rail and sender for fiat deposits with payer metadata', () => {
    const lines = getTxSubtitleLines(
      tx({
        source: 'fiat_deposit',
        direction: 'in',
        statusLabelKey: 'card.statusCompleted',
        paymentRail: 'ach_push',
        senderName: 'Jane Doe',
        senderBankRoutingNumber: '021000021',
      }),
      [],
    );
    expect(lines.primary).toBe('ACH');
    expect(lines.secondary).toBe('Jane Doe · Routing 021000021 · Completed');
  });
});

describe('getTxRecipientDisplay', () => {
  test('shows sender name and routing for ACH fiat deposit', () => {
    const display = getTxRecipientDisplay(
      tx({
        source: 'fiat_deposit',
        direction: 'in',
        counterparty: 'USD',
        senderName: 'Jane Doe',
        senderBankRoutingNumber: '021000021',
        paymentRail: 'ach_push',
      }),
      [],
      '0xsmart',
    );
    expect(display?.name).toBe('Jane Doe');
    expect(display?.addressLine).toBe('Routing 021000021');
  });

  test('shows bank transfer for fiat on-ramp without payer metadata', () => {
    const display = getTxRecipientDisplay(
      tx({
        source: 'fiat_deposit',
        direction: 'in',
        counterparty: 'COP',
        sourceFiatAmount: 1_800_000,
        sourceFiatCurrency: 'COP',
      }),
      [],
      '0xsmart',
    );
    expect(display?.name).toBe('Bank transfer');
    expect(display?.addressLine).toBe('COP');
  });

  test('shows bank account last4 for fiat withdrawal', () => {
    const display = getTxRecipientDisplay(
      tx({
        source: 'fiat_withdraw',
        direction: 'out',
        counterparty: 'USD',
        destinationRail: 'wire',
        accountLast4: '1234',
      }),
      [],
      '0xsmart',
    );
    expect(display?.name).toBe('Bank account');
    expect(display?.addressLine).toBe('•••• 1234 · Wire');
  });

  test('shows Morpho for borrow', () => {
    const display = getTxRecipientDisplay(
      tx({
        activityKind: 'borrow',
        direction: 'in',
        tokenSymbol: 'USDC',
        fromAddress: MORPHO_BLUE_ADDRESS,
        counterparty: MORPHO_BLUE_ADDRESS,
      }),
      [],
      '0xsmart',
    );
    expect(display?.name).toBe('Morpho');
  });
});

describe('resolveAddressDisplay', () => {
  test('labels smart account as your account without address line', () => {
    const smart = '0xsmart0000000000000000000000000000000001';
    const display = resolveAddressDisplay(smart, [], smart);
    expect(display?.name).toBe('Your account');
    expect(display?.addressLine).toBeUndefined();
  });
});
