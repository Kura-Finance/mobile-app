export type BiometricAuthFailureReason =
  | 'not_supported'
  | 'not_enrolled'
  | 'cancelled'
  | 'failed';

export type BiometricAuthResult =
  | { ok: true }
  | { ok: false; reason: BiometricAuthFailureReason };

export type BiometricAuthMethod = 'faceId' | 'touchId' | 'fingerprint' | 'none';

export const DeviceSecurityLevel = {
  NONE: 0,
  SECRET: 1,
  BIOMETRIC_WEAK: 2,
  BIOMETRIC_STRONG: 3,
} as const;

// Const object + matching value union (standard TS pattern).
// eslint-disable-next-line @typescript-eslint/no-redeclare -- intentional dual export
export type DeviceSecurityLevel =
  (typeof DeviceSecurityLevel)[keyof typeof DeviceSecurityLevel];

/** Mirrors expo-local-authentication AuthenticationType values. */
export const AuthenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
} as const;

export interface BiometricAuthenticateResult {
  success: boolean;
  error?: string;
}

export interface BiometricAuthDeps {
  getEnrolledLevelAsync: () => Promise<DeviceSecurityLevel>;
  supportedAuthenticationTypesAsync: () => Promise<number[]>;
  isEnrolledAsync: () => Promise<boolean>;
  authenticateAsync: (options: {
    promptMessage: string;
    cancelLabel: string;
    disableDeviceFallback: boolean;
  }) => Promise<BiometricAuthenticateResult>;
}

function isCancelled(error?: string): boolean {
  return error === 'user_cancel' || error === 'system_cancel' || error === 'app_cancel';
}

function hasBiometricEnrollment(level: DeviceSecurityLevel): boolean {
  return level >= DeviceSecurityLevel.BIOMETRIC_WEAK;
}

/**
 * Resolve whether on-device biometrics are available for the primary unlock button.
 * App PIN is handled separately in the app UI.
 */
export async function resolveBiometricAuthMethod(
  deps: Pick<
    BiometricAuthDeps,
    'getEnrolledLevelAsync' | 'supportedAuthenticationTypesAsync' | 'isEnrolledAsync'
  >,
  platform: 'ios' | 'android' | 'web' | 'windows' | 'macos' = 'ios',
): Promise<BiometricAuthMethod> {
  const level = await deps.getEnrolledLevelAsync();
  if (!hasBiometricEnrollment(level)) {
    return 'none';
  }

  const [types, enrolled] = await Promise.all([
    deps.supportedAuthenticationTypesAsync(),
    deps.isEnrolledAsync(),
  ]);

  if (!enrolled) {
    return 'none';
  }

  if (types.includes(AuthenticationType.FACIAL_RECOGNITION)) {
    return 'faceId';
  }

  if (types.includes(AuthenticationType.FINGERPRINT)) {
    return platform === 'ios' ? 'touchId' : 'fingerprint';
  }

  return 'none';
}

/**
 * Prompt the user for on-device biometric authentication only.
 * Device passcode fallback is disabled; use App PIN instead.
 */
export async function authenticateWithBiometrics(
  prompt: string,
  deps: BiometricAuthDeps,
): Promise<BiometricAuthResult> {
  const method = await resolveBiometricAuthMethod(deps);
  if (method === 'none') {
    return { ok: false, reason: 'not_enrolled' };
  }

  const result = await deps.authenticateAsync({
    promptMessage: prompt,
    cancelLabel: 'Cancel',
    disableDeviceFallback: true,
  });

  if (result.success) {
    return { ok: true };
  }

  if (result.error === 'passcode_not_set' || result.error === 'not_enrolled') {
    return { ok: false, reason: 'not_enrolled' };
  }

  if (result.error === 'not_available') {
    return { ok: false, reason: 'not_supported' };
  }

  if (isCancelled(result.error)) {
    return { ok: false, reason: 'cancelled' };
  }

  return { ok: false, reason: 'failed' };
}

export type BiometricPreferenceProvider = () => boolean;

let biometricPreferenceProvider: BiometricPreferenceProvider = () => true;

export function setBiometricPreferenceProvider(provider: BiometricPreferenceProvider): void {
  biometricPreferenceProvider = provider;
}

export function isBiometricUnlockPreferenceEnabled(): boolean {
  return biometricPreferenceProvider();
}

export async function hasBiometricUnlock(
  deps: Pick<
    BiometricAuthDeps,
    'getEnrolledLevelAsync' | 'supportedAuthenticationTypesAsync' | 'isEnrolledAsync'
  >,
  platform: 'ios' | 'android' | 'web' | 'windows' | 'macos' = 'ios',
): Promise<boolean> {
  if (!isBiometricUnlockPreferenceEnabled()) {
    return false;
  }
  const method = await resolveBiometricAuthMethod(deps, platform);
  return method !== 'none';
}
