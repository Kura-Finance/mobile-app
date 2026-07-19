import { describe, expect, test } from 'vitest';
import {
  authenticateWithBiometrics,
  resolveBiometricAuthMethod,
  DeviceSecurityLevel,
  AuthenticationType,
  type BiometricAuthDeps,
} from '../biometricAuthCore';

function makeDeps(overrides: Partial<BiometricAuthDeps> = {}): BiometricAuthDeps {
  return {
    getEnrolledLevelAsync: async () => DeviceSecurityLevel.BIOMETRIC_STRONG,
    supportedAuthenticationTypesAsync: async () => [AuthenticationType.FACIAL_RECOGNITION],
    isEnrolledAsync: async () => true,
    authenticateAsync: async () => ({ success: true }),
    ...overrides,
  };
}

describe('resolveBiometricAuthMethod', () => {
  test('returns none when only a device passcode is enrolled', async () => {
    const method = await resolveBiometricAuthMethod(
      makeDeps({
        getEnrolledLevelAsync: async () => DeviceSecurityLevel.SECRET,
      }),
    );
    expect(method).toBe('none');
  });

  test('returns faceId when facial recognition is enrolled', async () => {
    const method = await resolveBiometricAuthMethod(makeDeps(), 'ios');
    expect(method).toBe('faceId');
  });

  test('returns touchId on iOS when fingerprint is enrolled', async () => {
    const method = await resolveBiometricAuthMethod(
      makeDeps({
        supportedAuthenticationTypesAsync: async () => [AuthenticationType.FINGERPRINT],
      }),
      'ios',
    );
    expect(method).toBe('touchId');
  });

  test('returns fingerprint on Android when fingerprint is enrolled', async () => {
    const method = await resolveBiometricAuthMethod(
      makeDeps({
        supportedAuthenticationTypesAsync: async () => [AuthenticationType.FINGERPRINT],
      }),
      'android',
    );
    expect(method).toBe('fingerprint');
  });
});

describe('authenticateWithBiometrics', () => {
  test('returns not_enrolled when biometrics are unavailable', async () => {
    const result = await authenticateWithBiometrics(
      'Confirm',
      makeDeps({ getEnrolledLevelAsync: async () => DeviceSecurityLevel.NONE }),
    );
    expect(result).toEqual({ ok: false, reason: 'not_enrolled' });
  });

  test('does not use device passcode when only a device passcode is enrolled', async () => {
    const authenticateAsync = async () => ({ success: true });
    const result = await authenticateWithBiometrics(
      'Confirm',
      makeDeps({
        getEnrolledLevelAsync: async () => DeviceSecurityLevel.SECRET,
        isEnrolledAsync: async () => false,
        authenticateAsync,
      }),
    );
    expect(result).toEqual({ ok: false, reason: 'not_enrolled' });
  });

  test('disables device fallback when biometrics are used', async () => {
    let disableDeviceFallback: boolean | undefined;
    const result = await authenticateWithBiometrics(
      'Confirm',
      makeDeps({
        authenticateAsync: async (options) => {
          disableDeviceFallback = options.disableDeviceFallback;
          return { success: true };
        },
      }),
    );
    expect(result).toEqual({ ok: true });
    expect(disableDeviceFallback).toBe(true);
  });

  test('returns ok when authentication succeeds', async () => {
    const result = await authenticateWithBiometrics('Confirm', makeDeps());
    expect(result).toEqual({ ok: true });
  });

  test('returns cancelled when the user dismisses the prompt', async () => {
    const result = await authenticateWithBiometrics(
      'Confirm',
      makeDeps({
        authenticateAsync: async () => ({ success: false, error: 'user_cancel' }),
      }),
    );
    expect(result).toEqual({ ok: false, reason: 'cancelled' });
  });

  test('returns not_supported when local auth is unavailable', async () => {
    const result = await authenticateWithBiometrics(
      'Confirm',
      makeDeps({
        authenticateAsync: async () => ({ success: false, error: 'not_available' }),
      }),
    );
    expect(result).toEqual({ ok: false, reason: 'not_supported' });
  });

  test('returns failed for other authentication errors', async () => {
    const result = await authenticateWithBiometrics(
      'Confirm',
      makeDeps({
        authenticateAsync: async () => ({ success: false, error: 'lockout' }),
      }),
    );
    expect(result).toEqual({ ok: false, reason: 'failed' });
  });
});
