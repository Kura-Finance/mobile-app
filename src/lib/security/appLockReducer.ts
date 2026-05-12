/**
 * Pure state machine for the app background lock.
 *
 * Split out of `appLock.ts` (which depends on `react-native`'s `AppState`)
 * so the transition logic can be unit-tested in Node without an RN runtime.
 */

export type AppLockStatus = 'active' | 'inactive' | 'background' | 'unknown' | 'extension';

export const DEFAULT_BACKGROUND_LOCK_MS = 5 * 60 * 1000;

export interface AppLockReducerCtx {
  thresholdMs: number;
  backgroundedAt: number | null;
  now: () => number;
}

export interface AppLockReducerResult {
  nextBackgroundedAt: number | null;
  shouldLock: boolean;
}

export function handleAppStateChange(
  from: AppLockStatus,
  to: AppLockStatus,
  ctx: AppLockReducerCtx,
): AppLockReducerResult {
  const wentToBackground = to === 'background' && from !== 'background';
  const cameToForeground = from !== 'active' && to === 'active';

  if (wentToBackground) {
    return { nextBackgroundedAt: ctx.now(), shouldLock: false };
  }

  if (cameToForeground) {
    if (ctx.backgroundedAt === null) {
      return { nextBackgroundedAt: null, shouldLock: false };
    }
    const elapsed = ctx.now() - ctx.backgroundedAt;
    return {
      nextBackgroundedAt: null,
      shouldLock: elapsed >= ctx.thresholdMs,
    };
  }

  return { nextBackgroundedAt: ctx.backgroundedAt, shouldLock: false };
}
