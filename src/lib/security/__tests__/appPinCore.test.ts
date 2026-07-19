import { describe, expect, test } from 'vitest';
import {
  APP_PIN_LENGTH,
  createPinHash,
  isValidPinFormat,
  pinsMatch,
  verifyPin,
  type AppPinHashDeps,
} from '../appPinCore';

const hashDeps: AppPinHashDeps = {
  generateSalt: () => 'test-salt',
  hashPin: async (pin, salt) => `hash:${salt}:${pin}`,
};

describe('isValidPinFormat', () => {
  test('accepts a 6-digit PIN', () => {
    expect(isValidPinFormat('123456')).toBe(true);
  });

  test('rejects non-numeric and wrong lengths', () => {
    expect(isValidPinFormat('12345')).toBe(false);
    expect(isValidPinFormat('1234567')).toBe(false);
    expect(isValidPinFormat('12ab56')).toBe(false);
  });

  test('uses the configured pin length', () => {
    expect(APP_PIN_LENGTH).toBe(6);
  });
});

describe('createPinHash', () => {
  test('creates a salted hash record', async () => {
    const record = await createPinHash('123456', hashDeps);
    expect(record).toEqual({ salt: 'test-salt', hash: 'hash:test-salt:123456', version: 1 });
  });

  test('creates a v2 hash when hashPinV2 is provided', async () => {
    const record = await createPinHash('123456', {
      ...hashDeps,
      hashPinV2: async (pin, salt) => `v2:${salt}:${pin}`,
    });
    expect(record.version).toBe(2);
    expect(record.hash).toBe('v2:test-salt:123456');
  });
});

describe('verifyPin', () => {
  test('returns ok for the correct PIN', async () => {
    const record = await createPinHash('123456', hashDeps);
    const result = await verifyPin('123456', record, hashDeps);
    expect(result).toEqual({ ok: true });
  });

  test('returns wrong_pin for an incorrect PIN', async () => {
    const record = await createPinHash('123456', hashDeps);
    const result = await verifyPin('654321', record, hashDeps);
    expect(result).toEqual({ ok: false, reason: 'wrong_pin' });
  });

  test('returns no_pin_set when no record exists', async () => {
    const result = await verifyPin('123456', null, hashDeps);
    expect(result).toEqual({ ok: false, reason: 'no_pin_set' });
  });
});

describe('pinsMatch', () => {
  test('returns true when pins are identical', () => {
    expect(pinsMatch('123456', '123456')).toBe(true);
  });

  test('returns false when pins differ', () => {
    expect(pinsMatch('123456', '123457')).toBe(false);
  });
});
