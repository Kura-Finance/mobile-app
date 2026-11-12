/**
 * On-device wallet (no-backend mode).
 *
 * Without an app backend there is no Privy: the Safe owner key is created or
 * imported here and never leaves the device. The private key is stored under
 * WALLET_IMPORTED_KEY, which `resolveKuraSmartAccountClient` already prefers
 * over any embedded provider, so signing works unchanged.
 *
 * Nobody can restore this key for the user — the recovery phrase (or the
 * imported private key) is the only backup.
 */

import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import {
  WALLET_ADDRESS_STORE_KEY,
  WALLET_IMPORTED_KEY,
  WALLET_LOCAL_EOA_KEY,
  WALLET_MNEMONIC_KEY,
} from '../../features/card/config/cardWalletConfig';
import { resetKuraCardWalletSession } from '../../features/card/kuraCardWalletSession';
import { randomBytes } from '../crypto/random';
import { IMPORTED_KEY_SECURE_STORE, STANDARD_SECURE_STORE } from '../security/secureStoreOptions';
import Logger from '../../shared/utils/Logger';
import {
  MNEMONIC_ENTROPY_BYTES,
  eoaAddressFromPrivateKey,
  mnemonicFromEntropy,
  normalizeMnemonic,
  normalizePrivateKey,
  privateKeyFromBip44Mnemonic,
} from './localWalletCore';

/** What the user brings to (or gets from) this device. */
export type LocalWalletSecret =
  | { kind: 'mnemonic'; phrase: string }
  | { kind: 'privateKey'; privateKey: string };

/**
 * `error` means the keystore could not be read. It is deliberately not treated
 * as `absent`: offering "create wallet" then could overwrite an existing key.
 */
export type LocalWalletStatus = 'loading' | 'absent' | 'present' | 'error';

interface LocalWalletState {
  status: LocalWalletStatus;
  /** Owner EOA of the wallet on this device (checksummed), or null. */
  eoaAddress: string | null;
}

export const useLocalWalletStore = create<LocalWalletState>(() => ({
  status: 'loading',
  eoaAddress: null,
}));

/** New 12-word recovery phrase from the OS CSPRNG. Nothing is stored yet. */
export function generateRecoveryPhrase(): string {
  return mnemonicFromEntropy(randomBytes(MNEMONIC_ENTROPY_BYTES));
}

/**
 * Secrets are written behind the OS authentication gate. Devices without
 * enrolled biometrics / passcode reject that, so fall back to the standard
 * device-only keystore — the app lock (PIN / biometrics) still guards access.
 */
async function writeSecret(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value, IMPORTED_KEY_SECURE_STORE);
  } catch (err) {
    Logger.warn('LocalWallet', 'OS-authenticated storage unavailable — using device keystore', {
      error: err instanceof Error ? err.message : String(err),
    });
    await SecureStore.setItemAsync(key, value, STANDARD_SECURE_STORE);
  }
}

async function readSecret(key: string): Promise<string | null> {
  const authenticated = await SecureStore.getItemAsync(key, IMPORTED_KEY_SECURE_STORE);
  return authenticated ?? (await SecureStore.getItemAsync(key));
}

async function deleteEverywhere(key: string): Promise<void> {
  await Promise.allSettled([
    SecureStore.deleteItemAsync(key, IMPORTED_KEY_SECURE_STORE),
    SecureStore.deleteItemAsync(key),
  ]);
}

/** Read whether a wallet exists on this device. Call at boot, and again to retry after `error`. */
export async function hydrateLocalWallet(): Promise<void> {
  useLocalWalletStore.setState({ status: 'loading' });
  try {
    let eoaAddress = await SecureStore.getItemAsync(WALLET_LOCAL_EOA_KEY);
    if (!eoaAddress) {
      // A key imported by an earlier (Privy-era) build is this device's wallet:
      // adopt it rather than offer onboarding, which would overwrite it.
      const existingKey = await readSecret(WALLET_IMPORTED_KEY);
      if (existingKey) {
        eoaAddress = eoaAddressFromPrivateKey(normalizePrivateKey(existingKey));
        await SecureStore.setItemAsync(WALLET_LOCAL_EOA_KEY, eoaAddress, STANDARD_SECURE_STORE);
        Logger.info('LocalWallet', 'Adopted an existing imported key', { eoaAddress });
      }
    }
    useLocalWalletStore.setState(
      eoaAddress ? { status: 'present', eoaAddress } : { status: 'absent', eoaAddress: null },
    );
  } catch (err) {
    Logger.error('LocalWallet', 'Failed to read wallet marker', {
      error: err instanceof Error ? err.message : String(err),
    });
    useLocalWalletStore.setState({ status: 'error', eoaAddress: null });
  }
}

/**
 * Store a new or imported wallet as this device's wallet and return its owner
 * EOA address. Throws on an invalid phrase / key, or when the keystore refuses
 * the write — in both cases nothing is left half-installed.
 */
export async function installLocalWallet(secret: LocalWalletSecret): Promise<string> {
  const phrase = secret.kind === 'mnemonic' ? normalizeMnemonic(secret.phrase) : null;
  const privateKey = phrase
    ? privateKeyFromBip44Mnemonic(phrase)
    : normalizePrivateKey((secret as { privateKey: string }).privateKey);
  const eoaAddress = eoaAddressFromPrivateKey(privateKey);

  try {
    // The cached Safe address belongs to whichever key was here before.
    await SecureStore.deleteItemAsync(WALLET_ADDRESS_STORE_KEY);
    resetKuraCardWalletSession();

    await writeSecret(WALLET_IMPORTED_KEY, privateKey);
    if (phrase) {
      await writeSecret(WALLET_MNEMONIC_KEY, phrase);
    } else {
      await deleteEverywhere(WALLET_MNEMONIC_KEY);
    }
    // Written last: the marker is what makes the wallet "exist" at next boot.
    await SecureStore.setItemAsync(WALLET_LOCAL_EOA_KEY, eoaAddress, STANDARD_SECURE_STORE);
  } catch (err) {
    await wipeLocalWalletStorage();
    throw err;
  }

  useLocalWalletStore.setState({ status: 'present', eoaAddress });
  Logger.info('LocalWallet', 'Wallet installed on this device', {
    source: secret.kind,
    eoaAddress,
  });
  return eoaAddress;
}

/** Recovery material for backup: the phrase when there is one, always the key. */
export async function readRecoverySecret(): Promise<{
  phrase: string | null;
  privateKey: string;
} | null> {
  const privateKey = await readSecret(WALLET_IMPORTED_KEY);
  if (!privateKey) return null;
  const phrase = await readSecret(WALLET_MNEMONIC_KEY);
  return { phrase, privateKey };
}

async function wipeLocalWalletStorage(): Promise<void> {
  await Promise.allSettled([
    deleteEverywhere(WALLET_IMPORTED_KEY),
    deleteEverywhere(WALLET_MNEMONIC_KEY),
    SecureStore.deleteItemAsync(WALLET_LOCAL_EOA_KEY),
    SecureStore.deleteItemAsync(WALLET_ADDRESS_STORE_KEY),
  ]);
  resetKuraCardWalletSession();
}

/**
 * Remove the wallet from this device. Irreversible without the recovery
 * phrase / private key — callers must confirm with the user first.
 */
export async function removeLocalWallet(): Promise<void> {
  await wipeLocalWalletStorage();
  useLocalWalletStore.setState({ status: 'absent', eoaAddress: null });
  Logger.info('LocalWallet', 'Wallet removed from this device');
}
