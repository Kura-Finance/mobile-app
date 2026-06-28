import { describe, expect, test } from 'vitest';
import { usdFromFiatAmount } from '../fiatFx';

describe('usdFromFiatAmount', () => {
  test('returns USD unchanged', () => {
    expect(usdFromFiatAmount(100, 'USD')).toBe(100);
  });

  test('converts COP using fallback rate', () => {
    expect(usdFromFiatAmount(1_800_000, 'COP')).toBeCloseTo(1_800_000 / 4100, 1);
  });

  test('prefers live exchange rates when provided', () => {
    expect(
      usdFromFiatAmount(4_000, 'COP', {
        USD: 1,
        EUR: 0.92,
        TWD: 31.5,
        CNY: 7.1,
        JPY: 150,
        NGN: 1600,
        GBP: 0.79,
        BRL: 5.6,
        MXN: 17.2,
        COP: 4000,
        lastUpdated: Date.now(),
      }),
    ).toBe(1);
  });
});
