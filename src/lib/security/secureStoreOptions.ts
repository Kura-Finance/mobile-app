import * as SecureStore from 'expo-secure-store';

/** High-sensitivity secrets (imported private keys) — OS biometric/passcode gate on read. */
export const AUTHENTICATED_SECURE_STORE: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Unlock Kura',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Low-sensitivity metadata (session flag, public SCA address). */
export const STANDARD_SECURE_STORE: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Imported wallet key — same protection as session token. */
export const IMPORTED_KEY_SECURE_STORE = AUTHENTICATED_SECURE_STORE;
