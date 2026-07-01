import { describe, expect, it } from 'vitest';

import {
  isBridgeStreetLine1Valid,
  normalizeBridgeAddress,
  normalizeRoutingNumber,
  normalizeSortCode,
} from '../externalAccountNormalize';

describe('normalizeRoutingNumber', () => {
  it('strips non-digits and caps at 9 characters', () => {
    expect(normalizeRoutingNumber('021-000-089')).toBe('021000089');
    expect(normalizeRoutingNumber('02100008999')).toBe('021000089');
    expect(normalizeRoutingNumber(' 02100008 ')).toBe('02100008');
  });
});
describe('normalizeBridgeAddress', () => {
  it('truncates street lines to Bridge max length', () => {
    const result = normalizeBridgeAddress({
      street_line_1: '123 Very Long Street Name That Exceeds Limit',
      street_line_2: 'Apartment 456 Building C Extra Long Suite',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94102',
      country: 'USA',
    });
    expect(result).toEqual({
      street_line_1: '123 Very Long Street Name That Exce',
      street_line_2: 'Apartment 456 Building C Extra Long',
      city: 'San Francisco',
      state: 'CA',
      postal_code: '94102',
      country: 'USA',
    });
    expect(result.street_line_1.length).toBe(35);
    expect(result.street_line_2!.length).toBe(35);
  });
});

describe('isBridgeStreetLine1Valid', () => {
  it('requires 4–35 characters', () => {
    expect(isBridgeStreetLine1Valid('123')).toBe(false);
    expect(isBridgeStreetLine1Valid('123 Main St')).toBe(true);
    expect(isBridgeStreetLine1Valid('x'.repeat(36))).toBe(false);
  });
});

describe('normalizeSortCode', () => {
  it('strips non-digits and caps at 6 characters', () => {
    expect(normalizeSortCode('12-34-56')).toBe('123456');
  });
});
