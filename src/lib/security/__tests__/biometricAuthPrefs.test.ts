import { afterEach, describe, expect, test } from 'vitest';
import {
  AuthenticationType,
  DeviceSecurityLevel,
  hasBiometricUnlock,
  setBiometricPreferenceProvider,
  type BiometricAuthDeps,
} from '../biometricAuthCore';

function makeDeps(): BiometricAuthDeps {
  return {
    getEnrolledLevelAsync: async () => DeviceSecurityLevel.BIOMETRIC_STRONG,
    supportedAuthenticationTypesAsync: async () => [AuthenticationType.FACIAL_RECOGNITION],
    isEnrolledAsync: async () => true,
    authenticateAsync: async () => ({ success: true }),
  };
}

describe('hasBiometricUnlock preference', () => {
  afterEach(() => {
    setBiometricPreferenceProvider(() => true);
  });

  test('returns false when user disabled biometrics in app', async () => {
    setBiometricPreferenceProvider(() => false);
    await expect(hasBiometricUnlock(makeDeps())).resolves.toBe(false);
  });

  test('returns true when preference enabled and device enrolled', async () => {
    setBiometricPreferenceProvider(() => true);
    await expect(hasBiometricUnlock(makeDeps())).resolves.toBe(true);
  });

  test('returns false when device has no biometrics even if preference enabled', async () => {
    setBiometricPreferenceProvider(() => true);
    await expect(
      hasBiometricUnlock({
        ...makeDeps(),
        getEnrolledLevelAsync: async () => DeviceSecurityLevel.NONE,
      }),
    ).resolves.toBe(false);
  });
});
