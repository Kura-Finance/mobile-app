import { describe, expect, test } from 'vitest';
import { pickMerchantLogo, type PlaidTransaction } from '../types';

function makeTx(overrides: Partial<PlaidTransaction>): PlaidTransaction {
  return {
    transactionId: 'tx-1',
    accountId: 'acc-1',
    plaidItemId: null,
    date: '2026-05-12',
    month: '2026-05',
    isPending: false,
    isRecurring: false,
    isSubscription: false,
    cachedAt: '2026-05-12T00:00:00Z',
    amount: '12.34',
    merchant: 'Starbucks',
    category: 'food',
    type: 'place',
    ...overrides,
  };
}

describe('pickMerchantLogo', () => {
  test('prefers plaidMerchantLogo when present', () => {
    const tx = makeTx({
      plaidMerchantLogo: 'https://plaid.example/x.png',
      merchantLogo: 'https://logodev.example/x.png',
    });
    expect(pickMerchantLogo(tx)).toBe('https://plaid.example/x.png');
  });

  test('falls back to merchantLogo when plaidMerchantLogo is missing', () => {
    const tx = makeTx({ merchantLogo: 'https://logodev.example/y.png' });
    expect(pickMerchantLogo(tx)).toBe('https://logodev.example/y.png');
  });

  test('returns undefined when neither is present (no hardcoded fallback)', () => {
    const tx = makeTx({});
    expect(pickMerchantLogo(tx)).toBeUndefined();
  });

  test('treats empty string as missing', () => {
    const tx = makeTx({ plaidMerchantLogo: '', merchantLogo: '' });
    expect(pickMerchantLogo(tx)).toBeUndefined();
  });
});
