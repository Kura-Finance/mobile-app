import { describe, expect, test } from 'vitest';
import { handleAppStateChange } from '../appLockReducer';

describe('handleAppStateChange', () => {
  const baseCtx = { backgroundedAt: null, now: () => 1_000_000 };

  test('active → background records the timestamp without requiring biometrics', () => {
    const result = handleAppStateChange('active', 'background', baseCtx);
    expect(result.nextBackgroundedAt).toBe(1_000_000);
    expect(result.shouldRequireBiometric).toBe(false);
  });

  test('inactive → background also records (iOS transition order)', () => {
    const result = handleAppStateChange('inactive', 'background', baseCtx);
    expect(result.nextBackgroundedAt).toBe(1_000_000);
    expect(result.shouldRequireBiometric).toBe(false);
  });

  test('background → active requires biometrics on return', () => {
    const result = handleAppStateChange('background', 'active', {
      ...baseCtx,
      backgroundedAt: 1_000_000,
      now: () => 1_000_000 + 1_000,
    });
    expect(result.nextBackgroundedAt).toBeNull();
    expect(result.shouldRequireBiometric).toBe(true);
  });

  test('inactive → active with no recorded background does nothing', () => {
    const result = handleAppStateChange('inactive', 'active', baseCtx);
    expect(result.nextBackgroundedAt).toBeNull();
    expect(result.shouldRequireBiometric).toBe(false);
  });

  test('background → background does not reset timer', () => {
    const result = handleAppStateChange('background', 'background', {
      ...baseCtx,
      backgroundedAt: 1_000_000,
      now: () => 1_000_000 + 30_000,
    });
    expect(result.nextBackgroundedAt).toBe(1_000_000);
    expect(result.shouldRequireBiometric).toBe(false);
  });

  test('active → active with no prior background is a no-op', () => {
    const result = handleAppStateChange('active', 'active', baseCtx);
    expect(result.nextBackgroundedAt).toBeNull();
    expect(result.shouldRequireBiometric).toBe(false);
  });
});
