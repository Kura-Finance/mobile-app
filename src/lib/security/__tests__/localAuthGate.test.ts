import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  cancelLocalAuth,
  cancelLocalAuthForSessionLock,
  getLocalAuthPhase,
  isLocalAuthPending,
  registerLocalAuthNotifier,
  requireLocalAuth,
  submitLocalAuthBiometric,
  submitLocalAuthPin,
  switchLocalAuthToPin,
} from '../localAuthGate';
import { __resetPinRateLimitForTesting } from '../appPinRateLimit';
import { hasBiometricUnlock, authenticateWithBiometrics } from '../biometricAuth';

vi.mock('../appPin', () => ({
  hasAppPin: vi.fn(async () => true),
  verifyAppPin: vi.fn(async (pin: string) =>
    pin === '123456' ? { ok: true } : { ok: false, reason: 'wrong_pin' },
  ),
}));

vi.mock('../biometricAuth', () => ({
  hasBiometricUnlock: vi.fn(async () => false),
  resolveBiometricAuthMethod: vi.fn(async () => 'faceId' as const),
  authenticateWithBiometrics: vi.fn(async () => ({ ok: false, reason: 'not_enrolled' })),
}));

async function flushPendingGate(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('localAuthGate', () => {
  afterEach(() => {
    cancelLocalAuth();
    __resetPinRateLimitForTesting();
    vi.mocked(hasBiometricUnlock).mockResolvedValue(false);
    vi.mocked(authenticateWithBiometrics).mockResolvedValue({ ok: false, reason: 'not_enrolled' });
  });

  test('rejects concurrent requireLocalAuth calls', async () => {
    const first = requireLocalAuth('Confirm', 'card.biometricSendPrompt');
    await flushPendingGate();
    expect(isLocalAuthPending()).toBe(true);
    expect(getLocalAuthPhase()).toBe('pin');

    const second = await requireLocalAuth('Confirm', 'card.biometricWithdrawPrompt');
    expect(second).toEqual({ allowed: false, message: 'auth_in_progress' });

    await submitLocalAuthPin('123456');
    await expect(first).resolves.toEqual({ allowed: true });
    expect(isLocalAuthPending()).toBe(false);
  });

  test('starts on biometric phase when biometrics are available', async () => {
    vi.mocked(hasBiometricUnlock).mockResolvedValue(true);

    void requireLocalAuth('Confirm', 'card.biometricSendPrompt');
    await flushPendingGate();

    expect(getLocalAuthPhase()).toBe('biometric');
  });

  test('submitLocalAuthBiometric resolves on success', async () => {
    vi.mocked(hasBiometricUnlock).mockResolvedValue(true);
    vi.mocked(authenticateWithBiometrics).mockResolvedValue({ ok: true });

    const pending = requireLocalAuth('Confirm');
    await flushPendingGate();
    await submitLocalAuthBiometric();
    await expect(pending).resolves.toEqual({ allowed: true });
  });

  test('switchLocalAuthToPin moves to pin phase', async () => {
    vi.mocked(hasBiometricUnlock).mockResolvedValue(true);

    void requireLocalAuth('Confirm');
    await flushPendingGate();
    switchLocalAuthToPin();
    expect(getLocalAuthPhase()).toBe('pin');
  });

  test('cancelLocalAuth resolves pending auth as cancelled', async () => {
    const pending = requireLocalAuth('Confirm');
    await flushPendingGate();
    cancelLocalAuth();
    await expect(pending).resolves.toEqual({ allowed: false, cancelled: true });
    expect(isLocalAuthPending()).toBe(false);
  });

  test('cancelLocalAuthForSessionLock dismisses pending PIN UI', async () => {
    const pending = requireLocalAuth('Confirm');
    await flushPendingGate();
    cancelLocalAuthForSessionLock();
    await expect(pending).resolves.toEqual({ allowed: false, cancelled: true });
  });

  test('submitLocalAuthPin ignores calls when not in pin phase', async () => {
    vi.mocked(hasBiometricUnlock).mockResolvedValue(true);

    void requireLocalAuth('Confirm');
    await flushPendingGate();
    expect(getLocalAuthPhase()).toBe('biometric');

    const ok = await submitLocalAuthPin('123456');
    expect(ok).toBe(false);
    expect(isLocalAuthPending()).toBe(true);
    cancelLocalAuth();
  });

  test('notifies registered listeners', async () => {
    const listener = vi.fn();
    const unregister = registerLocalAuthNotifier(listener);

    void requireLocalAuth('Confirm');
    await flushPendingGate();
    expect(listener).toHaveBeenCalled();

    unregister();
    cancelLocalAuth();
  });
});
