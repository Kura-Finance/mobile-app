import { describe, expect, test } from 'vitest';
import { handleAppStateChange } from '../appLockReducer';

describe('handleAppStateChange', () => {
  const baseCtx = { thresholdMs: 5 * 60 * 1000, backgroundedAt: null, now: () => 1_000_000 };

  test('active → background records the timestamp', () => {
    const result = handleAppStateChange('active', 'background', baseCtx);
    expect(result.nextBackgroundedAt).toBe(1_000_000);
    expect(result.shouldLock).toBe(false);
  });

  test('inactive → background also records (iOS transition order)', () => {
    const result = handleAppStateChange('inactive', 'background', baseCtx);
    expect(result.nextBackgroundedAt).toBe(1_000_000);
    expect(result.shouldLock).toBe(false);
  });

  test('background → active under threshold does not lock', () => {
    const result = handleAppStateChange('background', 'active', {
      ...baseCtx,
      backgroundedAt: 1_000_000,
      now: () => 1_000_000 + 60_000, // 1 min
    });
    expect(result.nextBackgroundedAt).toBeNull();
    expect(result.shouldLock).toBe(false);
  });

  test('background → active at threshold locks', () => {
    const result = handleAppStateChange('background', 'active', {
      ...baseCtx,
      backgroundedAt: 1_000_000,
      now: () => 1_000_000 + 5 * 60 * 1000,
    });
    expect(result.shouldLock).toBe(true);
  });

  test('background → active well over threshold locks', () => {
    const result = handleAppStateChange('background', 'active', {
      ...baseCtx,
      backgroundedAt: 1_000_000,
      now: () => 1_000_000 + 60 * 60 * 1000, // 1h later
    });
    expect(result.shouldLock).toBe(true);
  });

  test('inactive → active with no recorded background does nothing', () => {
    const result = handleAppStateChange('inactive', 'active', baseCtx);
    expect(result.nextBackgroundedAt).toBeNull();
    expect(result.shouldLock).toBe(false);
  });

  test('background → background does not reset timer', () => {
    const result = handleAppStateChange('background', 'background', {
      ...baseCtx,
      backgroundedAt: 1_000_000,
      now: () => 1_000_000 + 30_000,
    });
    expect(result.nextBackgroundedAt).toBe(1_000_000);
    expect(result.shouldLock).toBe(false);
  });

  test('active → active with no prior background is a no-op', () => {
    const result = handleAppStateChange('active', 'active', baseCtx);
    expect(result.nextBackgroundedAt).toBeNull();
    expect(result.shouldLock).toBe(false);
  });
});
