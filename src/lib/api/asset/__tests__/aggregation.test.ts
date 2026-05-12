import { describe, expect, test } from 'vitest';
import {
  aggregateAssetHistory,
  parseMetricKey,
  uniqueUtcDays,
  type DecryptedAssetSnapshot,
} from '../aggregation';

function snap(
  metric: string,
  value: number,
  recordedAt: string,
  id = `${metric}@${recordedAt}`,
): DecryptedAssetSnapshot {
  return { id, metric, recordedAt, value };
}

describe('parseMetricKey', () => {
  test('bare base name', () => {
    expect(parseMetricKey('cashFlow')).toEqual({
      base: 'cashFlow',
      subScope: null,
      isSupported: true,
    });
  });

  test('sub-scoped key', () => {
    expect(parseMetricKey('cryptoSpot:exchange:acct-123')).toEqual({
      base: 'cryptoSpot',
      subScope: 'exchange:acct-123',
      isSupported: true,
    });
  });

  test('unknown base returns isSupported=false', () => {
    expect(parseMetricKey('forex:abc')).toEqual({
      base: null,
      subScope: 'abc',
      isSupported: false,
    });
  });

  test('unknown bare metric returns isSupported=false', () => {
    expect(parseMetricKey('random')).toEqual({
      base: null,
      subScope: null,
      isSupported: false,
    });
  });
});

describe('aggregateAssetHistory', () => {
  test('empty input → empty output', () => {
    expect(aggregateAssetHistory([])).toEqual([]);
  });

  test('single base metric, single day', () => {
    const rows = [snap('cashFlow', 1500, '2026-05-10T10:00:00Z')];
    const points = aggregateAssetHistory(rows);
    expect(points).toHaveLength(1);
    expect(points[0]).toMatchObject({
      date: '2026-05-10',
      cashFlow: 1500,
      plaidInvestment: 0,
      cryptoSpot: 0,
      defiProtocol: 0,
      totalAssets: 0,
    });
  });

  test('same sub-scoped key, same day, multiple recordings → keep latest', () => {
    const rows = [
      snap('cryptoSpot:exchange:acct-123', 100, '2026-05-10T01:00:00Z'),
      snap('cryptoSpot:exchange:acct-123', 200, '2026-05-10T15:00:00Z'),
      snap('cryptoSpot:exchange:acct-123', 150, '2026-05-10T10:00:00Z'),
    ];
    const points = aggregateAssetHistory(rows);
    expect(points).toHaveLength(1);
    expect(points[0].cryptoSpot).toBe(200);
  });

  test('different sub-scopes, same day, same base → sum', () => {
    const rows = [
      snap('cryptoSpot:exchange:acct-123', 100, '2026-05-10T10:00:00Z'),
      snap('cryptoSpot:debank:0xaaa', 250, '2026-05-10T10:00:00Z'),
      snap('cryptoSpot:debank:0xbbb', 75, '2026-05-10T10:00:00Z'),
    ];
    const points = aggregateAssetHistory(rows);
    expect(points[0].cryptoSpot).toBe(425);
    expect(points[0].totalAssets).toBe(425);
  });

  test('combines base row and sub-scoped rows for the same base on the same day', () => {
    // Pure-base entry is treated as its own implicit sub-scope so it co-sums
    // with the others.
    const rows = [
      snap('cryptoSpot', 500, '2026-05-10T10:00:00Z'),
      snap('cryptoSpot:exchange:acct-123', 100, '2026-05-10T10:00:00Z'),
    ];
    const points = aggregateAssetHistory(rows);
    expect(points[0].cryptoSpot).toBe(600);
  });

  test('multi-day series across multiple bases with carry-forward', () => {
    const rows = [
      // 2026-05-10
      snap('cashFlow', 1000, '2026-05-10T00:00:00Z'),
      snap('plaidInvestment', 5000, '2026-05-10T00:00:00Z'),
      // 2026-05-11 (no cashFlow today)
      snap('plaidInvestment', 5200, '2026-05-11T00:00:00Z'),
      // 2026-05-12
      snap('cashFlow', 1100, '2026-05-12T00:00:00Z'),
      snap('plaidInvestment', 5500, '2026-05-12T00:00:00Z'),
    ];

    const points = aggregateAssetHistory(rows, { carryForward: true });
    expect(points).toHaveLength(3);

    expect(points[0]).toMatchObject({
      date: '2026-05-10',
      cashFlow: 1000,
      plaidInvestment: 5000,
      totalAssets: 5000,
    });

    // No cashFlow row on 2026-05-11 → carried from prev day (1000)
    expect(points[1]).toMatchObject({
      date: '2026-05-11',
      cashFlow: 1000,
      plaidInvestment: 5200,
      totalAssets: 5200,
    });

    expect(points[2]).toMatchObject({
      date: '2026-05-12',
      cashFlow: 1100,
      plaidInvestment: 5500,
      totalAssets: 5500,
    });
  });

  test('carryForward=false zeroes missing bases', () => {
    const rows = [
      snap('cashFlow', 1000, '2026-05-10T00:00:00Z'),
      snap('plaidInvestment', 5000, '2026-05-11T00:00:00Z'),
    ];
    const points = aggregateAssetHistory(rows, { carryForward: false });
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ cashFlow: 1000, plaidInvestment: 0, totalAssets: 0 });
    expect(points[1]).toMatchObject({ cashFlow: 0, plaidInvestment: 5000, totalAssets: 5000 });
  });

  test('explicit days option pads gaps with carry-forward defaults to 0 then prior', () => {
    const rows = [
      snap('cashFlow', 1000, '2026-05-10T12:00:00Z'),
      snap('cashFlow', 1200, '2026-05-12T12:00:00Z'),
    ];
    const points = aggregateAssetHistory(rows, {
      carryForward: true,
      days: ['2026-05-09', '2026-05-10', '2026-05-11', '2026-05-12'],
    });
    expect(points.map((p) => p.cashFlow)).toEqual([0, 1000, 1000, 1200]);
  });

  test('uniqueUtcDays returns ascending unique day list', () => {
    const rows = [
      snap('cashFlow', 1, '2026-05-12T01:00:00Z'),
      snap('cashFlow', 2, '2026-05-10T01:00:00Z'),
      snap('cashFlow', 3, '2026-05-12T23:59:59Z'),
      snap('cashFlow', 4, '2026-05-11T12:00:00Z'),
    ];
    expect(uniqueUtcDays(rows)).toEqual(['2026-05-10', '2026-05-11', '2026-05-12']);
  });

  test('rows with unsupported base are silently ignored', () => {
    const rows = [
      snap('cashFlow', 1000, '2026-05-10T00:00:00Z'),
      snap('mystery_base:foo', 99999, '2026-05-10T00:00:00Z'),
    ];
    const points = aggregateAssetHistory(rows);
    expect(points[0].cashFlow).toBe(1000);
    expect(points[0].totalAssets).toBe(0);
  });

  test('totalAssets equals plaidInvestment + cryptoSpot net-worth sum', () => {
    const rows = [
      snap('cashFlow', 100, '2026-05-10T00:00:00Z'),
      snap('plaidInvestment', 200, '2026-05-10T00:00:00Z'),
      snap('cryptoSpot:exchange:e1', 300, '2026-05-10T00:00:00Z'),
      snap('defiProtocol:debank:0x1', 400, '2026-05-10T00:00:00Z'),
    ];
    const points = aggregateAssetHistory(rows);
    expect(points[0].totalAssets).toBe(500);
  });
});
