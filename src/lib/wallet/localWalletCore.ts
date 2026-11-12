/**
 * Local wallet — pure key helpers.
 *
 * Without an app backend there is no Privy: the Safe owner is an EOA whose key
 * is created (or imported) on this device. This file only does derivation and
 * validation, with no React Native imports, so it can be unit-tested in Node.
 */

import { HDNodeWallet, Mnemonic } from 'ethers';
import { privateKeyToAccount } from 'viem/accounts';

/** BIP-44 path of the first Ethereum account (MetaMask, hardware wallets, Privy HD index 0). */
export const BIP44_ETH_PATH = "m/44'/60'/0'/0/0";

/** 128 bits of entropy → 12-word BIP-39 phrase. */
export const MNEMONIC_ENTROPY_BYTES = 16;

export function normalizeMnemonic(phrase: string): string {
  return phrase.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** BIP-39 phrase for the given entropy (16 bytes → 12 words). */
export function mnemonicFromEntropy(entropy: Uint8Array): string {
  if (entropy.length !== MNEMONIC_ENTROPY_BYTES) {
    throw new Error(`Expected ${MNEMONIC_ENTROPY_BYTES} bytes of entropy`);
  }
  return Mnemonic.fromEntropy(entropy).phrase;
}

/** Private key (hex, no 0x) of the first BIP-44 Ethereum account of a phrase. */
export function privateKeyFromBip44Mnemonic(phrase: string): string {
  const cleaned = normalizeMnemonic(phrase);
  if (!Mnemonic.isValidMnemonic(cleaned)) {
    throw new Error('Invalid recovery phrase — please check every word and try again.');
  }
  const account = HDNodeWallet.fromPhrase(cleaned, undefined, BIP44_ETH_PATH);
  return account.privateKey.replace(/^0x/, '').toLowerCase();
}

/**
 * Validate a pasted private key (64 hex characters, optional 0x prefix) and
 * return it as lowercase hex without the prefix.
 */
export function normalizePrivateKey(input: string): string {
  const hex = input.trim().replace(/^0x/i, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error('A private key is 64 hexadecimal characters.');
  }
  try {
    privateKeyToAccount(`0x${hex}`);
  } catch {
    throw new Error('This is not a valid private key.');
  }
  return hex;
}

/** Checksummed EOA address for a private key (hex, no 0x). */
export function eoaAddressFromPrivateKey(privateKey: string): `0x${string}` {
  return privateKeyToAccount(`0x${privateKey}`).address;
}
