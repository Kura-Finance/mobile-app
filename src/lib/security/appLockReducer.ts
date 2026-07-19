/**
 * Pure state machine for the app background lock.
 *
 * Split out of `appLock.ts` (which depends on `react-native`'s `AppState`)
 * so the transition logic can be unit-tested in Node without an RN runtime.
 */

export type AppLockStatus = 'active' | 'inactive' | 'background' | 'unknown' | 'extension';

export interface AppLockReducerCtx {
  backgroundedAt: number | null;
  now: () => number;
}

export interface AppLockReducerResult {
  nextBackgroundedAt: number | null;
  shouldRequireBiometric: boolean;
}

export function handleAppStateChange(
  from: AppLockStatus,
  to: AppLockStatus,
  ctx: AppLockReducerCtx,
): AppLockReducerResult {
  const wentToBackground = to === 'background' && from !== 'background';
  const cameToForeground = from !== 'active' && to === 'active';

  if (wentToBackground) {
    return { nextBackgroundedAt: ctx.now(), shouldRequireBiometric: false };
  }

  if (cameToForeground) {
    if (ctx.backgroundedAt === null) {
      return { nextBackgroundedAt: null, shouldRequireBiometric: false };
    }
    return {
      nextBackgroundedAt: null,
      shouldRequireBiometric: true,
    };
  }

  return { nextBackgroundedAt: ctx.backgroundedAt, shouldRequireBiometric: false };
}
