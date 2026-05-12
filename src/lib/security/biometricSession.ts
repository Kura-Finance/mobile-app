/**
 * Biometric-protected X25519 private key storage.
 *
 * After a successful login the private key is wrapped under a biometric-bound
 * Keychain entry (Face ID / Touch ID / device passcode). When AppLock clears
 * the in-memory CryptoSession, the user can restore decryption capability
 * with a single biometric check — no password re-entry required.
 *
 * Security model:
 *   - The private key is stored in the OS Keychain with `requireAuthentication: true`.
 *     On iOS this maps to kSecAccessControlBiometryAny | DevicePasscode.
 *   - Even if the Keychain entry is extracted via a backup, it cannot be read
 *     without passing the biometric/passcode check on the enrolled device.
 *   - `dekWrapKey` / `localCacheKey` (password-derived material) are NOT stored here;
 *     they remain ephemeral. A biometric-restored session supports E2EE decryption
 *     but NOT key rotation or password change (those still require a full login).
 */

import * as SecureStore from 'expo-secure-store';
import { bytesToBase64, base64ToBytes } from '../crypto/encoding';

const PRIVATE_KEY_STORE = 'kura.bio.x25519.priv';
const PUBLIC_KEY_STORE = 'kura.bio.x25519.pub';

const BIOMETRIC_OPTIONS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const PUBKEY_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED,
};

/**
 * Save the X25519 private key under biometric protection.
 * Called once after every successful login or registration.
 * Silently no-ops if the device doesn't support biometric/passcode.
 */
export async function saveBiometricPrivateKey(
  x25519PrivateKey: Uint8Array,
  x25519PublicKeyBase64: string,
): Promise<void> {
  await SecureStore.setItemAsync(
    PRIVATE_KEY_STORE,
    bytesToBase64(x25519PrivateKey),
    BIOMETRIC_OPTIONS,
  );
  await SecureStore.setItemAsync(PUBLIC_KEY_STORE, x25519PublicKeyBase64, PUBKEY_OPTIONS);
}

/**
 * Check whether a biometric-protected private key has been saved.
 * Does NOT trigger a biometric prompt.
 */
export async function hasBiometricKey(): Promise<boolean> {
  const pub = await SecureStore.getItemAsync(PUBLIC_KEY_STORE, PUBKEY_OPTIONS).catch(() => null);
  return pub !== null;
}

/**
 * Prompt biometric auth and return the stored X25519 keys.
 * Returns `null` if biometric is unavailable, not enrolled, cancelled, or the
 * key hasn't been saved yet — callers should fall back to password re-auth.
 */
export async function restoreWithBiometrics(): Promise<{
  x25519PrivateKey: Uint8Array;
  x25519PublicKeyBase64: string;
} | null> {
  try {
    const privateKeyB64 = await SecureStore.getItemAsync(PRIVATE_KEY_STORE, BIOMETRIC_OPTIONS);
    const publicKeyB64 = await SecureStore.getItemAsync(PUBLIC_KEY_STORE, PUBKEY_OPTIONS);
    if (!privateKeyB64 || !publicKeyB64) return null;
    return {
      x25519PrivateKey: base64ToBytes(privateKeyB64),
      x25519PublicKeyBase64: publicKeyB64,
    };
  } catch {
    return null;
  }
}

/**
 * Delete the biometric-protected private key.
 * Called on logout and account deletion.
 */
export async function deleteBiometricKey(): Promise<void> {
  await SecureStore.deleteItemAsync(PRIVATE_KEY_STORE, BIOMETRIC_OPTIONS).catch(() => {});
  await SecureStore.deleteItemAsync(PUBLIC_KEY_STORE, PUBKEY_OPTIONS).catch(() => {});
}
