import { describe, expect, test } from 'vitest';
import {
  base64ToBytes,
  bytesToBase64,
  bytesToHex,
  hexToBytes,
} from '../encoding';

describe('encoding', () => {
  test('hex roundtrip', () => {
    const bytes = new Uint8Array([0x00, 0xff, 0xab, 0xcd, 0xef]);
    const hex = bytesToHex(bytes);
    expect(hex).toBe('00ffabcdef');
    expect(Array.from(hexToBytes(hex))).toEqual(Array.from(bytes));
  });

  test('base64 roundtrip', () => {
    const bytes = new Uint8Array(60);
    for (let i = 0; i < bytes.length; i++) bytes[i] = i;
    const b64 = bytesToBase64(bytes);
    expect(b64.length).toBe(80);
    expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
  });

  test('hexToBytes rejects odd length', () => {
    expect(() => hexToBytes('abc')).toThrow();
  });

  test('hexToBytes rejects non-hex', () => {
    expect(() => hexToBytes('zz')).toThrow();
  });
});
