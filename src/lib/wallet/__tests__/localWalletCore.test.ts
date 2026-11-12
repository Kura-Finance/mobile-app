import { describe, expect, it } from 'vitest';
import {
  eoaAddressFromPrivateKey,
  mnemonicFromEntropy,
  normalizePrivateKey,
  privateKeyFromBip44Mnemonic,
} from '../localWalletCore';

// BIP-39 reference vector: all-zero 128-bit entropy.
const ZERO_PHRASE =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
// Widely published first account (m/44'/60'/0'/0/0) for that phrase.
const ZERO_PHRASE_ADDRESS = '0x9858EfFD232B4033E47d90003D41EC34EcaEda94';

describe('mnemonicFromEntropy', () => {
  it('matches the BIP-39 reference vector', () => {
    expect(mnemonicFromEntropy(new Uint8Array(16))).toBe(ZERO_PHRASE);
  });

  it('produces different 12-word phrases for different entropy', () => {
    const a = mnemonicFromEntropy(new Uint8Array(16).fill(1));
    const b = mnemonicFromEntropy(new Uint8Array(16).fill(2));
    expect(a).not.toBe(b);
    expect(a.split(' ')).toHaveLength(12);
  });

  it('rejects entropy of the wrong length', () => {
    expect(() => mnemonicFromEntropy(new Uint8Array(8))).toThrow();
    expect(() => mnemonicFromEntropy(new Uint8Array(32))).toThrow();
  });
});

describe('privateKeyFromBip44Mnemonic', () => {
  it('derives the standard first Ethereum account', () => {
    const key = privateKeyFromBip44Mnemonic(ZERO_PHRASE);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(eoaAddressFromPrivateKey(key)).toBe(ZERO_PHRASE_ADDRESS);
  });

  it('tolerates extra whitespace and capitals', () => {
    const messy = `  ${ZERO_PHRASE.toUpperCase().replace(/ /g, '   ')}\n`;
    expect(privateKeyFromBip44Mnemonic(messy)).toBe(privateKeyFromBip44Mnemonic(ZERO_PHRASE));
  });

  it('rejects a phrase with a bad checksum', () => {
    expect(() => privateKeyFromBip44Mnemonic(ZERO_PHRASE.replace(/about$/, 'abandon'))).toThrow();
  });
});

describe('normalizePrivateKey', () => {
  const key = privateKeyFromBip44Mnemonic(ZERO_PHRASE);

  it('accepts hex with or without 0x, in any case', () => {
    expect(normalizePrivateKey(key)).toBe(key);
    expect(normalizePrivateKey(`0x${key.toUpperCase()}`)).toBe(key);
    expect(normalizePrivateKey(`  0X${key}  `)).toBe(key);
  });

  it('rejects the wrong length, non-hex input, and out-of-range keys', () => {
    expect(() => normalizePrivateKey(key.slice(2))).toThrow();
    expect(() => normalizePrivateKey(`${key.slice(0, 63)}z`)).toThrow();
    expect(() => normalizePrivateKey('0'.repeat(64))).toThrow();
    expect(() => normalizePrivateKey('f'.repeat(64))).toThrow();
  });
});
