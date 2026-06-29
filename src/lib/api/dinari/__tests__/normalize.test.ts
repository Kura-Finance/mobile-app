import { describe, expect, test } from 'vitest';

import { normalizeDinariStockPrice, normalizeDinariStockQuote } from '../normalize';

describe('normalizeDinariStockQuote', () => {
  test('maps Dinari snake_case bid/ask fields', () => {
    const result = normalizeDinariStockQuote({
      stock_id: 'abc',
      bid_price: 1.58,
      ask_price: 1.6,
      bid_size: 100,
      ask_size: 50,
      timestamp: '2026-06-29T12:00:00Z',
    });
    expect(result).toMatchObject({
      bid: 1.58,
      ask: 1.6,
      bidSize: 100,
      askSize: 50,
      timestamp: '2026-06-29T12:00:00Z',
    });
    expect(result.spread).toBeCloseTo(0.02, 5);
  });

  test('treats 0 bid/ask as absent (no resting quote)', () => {
    expect(normalizeDinariStockQuote({
      bid_price: 0,
      ask_price: 0,
    })).toEqual({
      bid: undefined,
      ask: undefined,
      spread: undefined,
      bidSize: undefined,
      askSize: undefined,
      timestamp: undefined,
    });
  });

  test('unwraps nested quote payloads from backend proxies', () => {
    const result = normalizeDinariStockQuote({
      quote: {
        bid_price: '2.10',
        ask_price: '2.12',
      },
    });
    expect(result.bid).toBe(2.1);
    expect(result.ask).toBe(2.12);
    expect(result.spread).toBeCloseTo(0.02, 5);
  });

  test('supports camelCase and websocket PascalCase fields', () => {
    const result = normalizeDinariStockQuote({
      BidPrice: 0.01,
      AskPrice: 0.03,
      BidSize: 150,
      AskSize: 80,
      TimeStamp: '2026-06-29T12:00:00Z',
    });
    expect(result).toMatchObject({
      bid: 0.01,
      ask: 0.03,
      bidSize: 150,
      askSize: 80,
      timestamp: '2026-06-29T12:00:00Z',
    });
    expect(result.spread).toBeCloseTo(0.02, 5);
  });
});

describe('normalizeDinariStockPrice', () => {
  test('reads price from snake_case and camelCase', () => {
    expect(normalizeDinariStockPrice({ price: 1.59 })).toBe(1.59);
    expect(normalizeDinariStockPrice({ last_price: '1.59' })).toBe(1.59);
  });
});
