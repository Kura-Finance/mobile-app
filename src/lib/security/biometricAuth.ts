import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  authenticateWithBiometrics as authenticateWithBiometricsCore,
  resolveBiometricAuthMethod as resolveBiometricAuthMethodCore,
  hasBiometricUnlock as hasBiometricUnlockCore,
  type BiometricAuthDeps,
  type BiometricAuthResult,
  type BiometricAuthMethod,
} from './biometricAuthCore';

export type {
  BiometricAuthFailureReason,
  BiometricAuthDeps,
  BiometricAuthResult,
  BiometricAuthMethod,
  DeviceSecurityLevel,
  BiometricPreferenceProvider,
} from './biometricAuthCore';

export {
  DeviceSecurityLevel,
  AuthenticationType,
  setBiometricPreferenceProvider,
  isBiometricUnlockPreferenceEnabled,
} from './biometricAuthCore';

const defaultDeps: BiometricAuthDeps = {
  getEnrolledLevelAsync: () => LocalAuthentication.getEnrolledLevelAsync(),
  supportedAuthenticationTypesAsync: () =>
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  isEnrolledAsync: () => LocalAuthentication.isEnrolledAsync(),
  authenticateAsync: (options) => LocalAuthentication.authenticateAsync(options),
};

export function authenticateWithBiometrics(
  prompt: string,
  deps: BiometricAuthDeps = defaultDeps,
): Promise<BiometricAuthResult> {
  return authenticateWithBiometricsCore(prompt, deps);
}

export function resolveBiometricAuthMethod(
  deps: BiometricAuthDeps = defaultDeps,
): Promise<BiometricAuthMethod> {
  return resolveBiometricAuthMethodCore(deps, Platform.OS);
}

export async function hasDeviceBiometricEnrollment(
  deps: BiometricAuthDeps = defaultDeps,
): Promise<boolean> {
  const method = await resolveBiometricAuthMethodCore(deps, Platform.OS);
  return method !== 'none';
}

export async function hasBiometricUnlock(
  deps: BiometricAuthDeps = defaultDeps,
): Promise<boolean> {
  return hasBiometricUnlockCore(deps, Platform.OS);
}
