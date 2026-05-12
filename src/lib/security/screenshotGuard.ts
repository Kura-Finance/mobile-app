/**
 * Blocks screenshots and screen recording when enabled (expo-screen-capture).
 * Android: FLAG_SECURE. iOS: UIScreen capture prevention.
 */

import { AppState, type NativeEventSubscription } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import Logger from '../../shared/utils/Logger';

const SCREEN_CAPTURE_KEY = 'kura-security';

let desiredDisableScreenshot = false;
let appliedDisableScreenshot = false;
let appStateSubscription: NativeEventSubscription | null = null;

export async function applyScreenshotPolicy(
  disableScreenshot: boolean,
  options?: { force?: boolean },
): Promise<boolean> {
  desiredDisableScreenshot = disableScreenshot;

  if (!options?.force && disableScreenshot === appliedDisableScreenshot) {
    return true;
  }

  try {
    const available = await ScreenCapture.isAvailableAsync();
    if (!available) {
      Logger.warn('ScreenshotGuard', 'Screen capture API unavailable on this device');
      return false;
    }

    if (disableScreenshot) {
      // expo-screen-capture skips the native call when the key is already active;
      // allow first so FLAG_SECURE is re-applied after activity recreation.
      if (options?.force && appliedDisableScreenshot) {
        await ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_KEY);
      }
      await ScreenCapture.preventScreenCaptureAsync(SCREEN_CAPTURE_KEY);
      appliedDisableScreenshot = true;
      Logger.debug('ScreenshotGuard', 'Screenshot capture disabled');
    } else {
      await ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_KEY);
      appliedDisableScreenshot = false;
      Logger.debug('ScreenshotGuard', 'Screenshot capture allowed');
    }

    return true;
  } catch (error) {
    Logger.warn('ScreenshotGuard', 'Failed to update screenshot policy', {
      disableScreenshot,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** Re-apply FLAG_SECURE when returning to foreground (Android clears it on some lifecycles). */
export function installScreenshotGuard(): () => void {
  if (appStateSubscription) {
    return () => appStateSubscription?.remove();
  }

  appStateSubscription = AppState.addEventListener('change', (nextState) => {
    if (nextState === 'active' && desiredDisableScreenshot) {
      void applyScreenshotPolicy(true, { force: true });
    }
  });

  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
  };
}
