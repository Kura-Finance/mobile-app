/**
 * Local (no-backend) session state.
 *
 * Holds the id of the wallet on this device and its on-device profile overlay
 * so the app store can build a profile without a backend. Only used when
 * EXPO_PUBLIC_API_BASE_URL is empty — see {@link isLocalSessionMode}.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { hasAppBackend } from '../../config/env';
import type { UserProfileV1 } from '../api/auth/schemas';
import Logger from '../../shared/utils/Logger';
import {
  buildLocalProfile,
  parseLocalProfileOverlay,
  type LocalProfileOverlay,
} from './localSessionCore';

export { LOCAL_SESSION_TOKEN, localUserId } from './localSessionCore';

const OVERLAY_KEY_PREFIX = '@kura/localProfile/';

let currentUserId: string | null = null;
let currentOverlay: LocalProfileOverlay = {};
/** Resolves once the overlay for {@link currentUserId} has been read from disk. */
let overlayLoaded: Promise<void> = Promise.resolve();

/**
 * True when no app backend is configured. The app then runs without Privy:
 * the wallet key lives on this device and its presence is the session.
 */
export function isLocalSessionMode(): boolean {
  return !hasAppBackend();
}

function overlayKey(userId: string): string {
  return `${OVERLAY_KEY_PREFIX}${userId}`;
}

/**
 * Point the local session at the wallet on this device (or `null` once it is
 * removed). The id is bound synchronously; its on-device overlay loads in the
 * background — read the result with {@link loadLocalProfile}.
 */
export function bindLocalSessionUser(userId: string | null): void {
  if (!userId) {
    currentUserId = null;
    currentOverlay = {};
    overlayLoaded = Promise.resolve();
    return;
  }

  if (currentUserId === userId) return;
  currentUserId = userId;

  currentOverlay = {};
  overlayLoaded = AsyncStorage.getItem(overlayKey(userId))
    .then((raw) => {
      if (currentUserId === userId) {
        currentOverlay = parseLocalProfileOverlay(raw);
      }
    })
    .catch((err) => {
      Logger.warn('LocalSession', 'Failed to load local profile', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
}

/**
 * Profile for the bound wallet once its overlay has loaded, or `null` when
 * there is no wallet on this device.
 */
export async function loadLocalProfile(): Promise<UserProfileV1 | null> {
  await overlayLoaded;
  return currentUserId ? buildLocalProfile(currentUserId, currentOverlay) : null;
}

/** Persist display name / avatar on this device and return the updated profile. */
export async function updateLocalProfileOverlay(
  patch: LocalProfileOverlay,
): Promise<UserProfileV1> {
  await overlayLoaded;
  const userId = currentUserId;
  if (!userId) throw new Error('No wallet on this device');

  const next: LocalProfileOverlay = { ...currentOverlay, ...patch };
  await AsyncStorage.setItem(overlayKey(userId), JSON.stringify(next));
  if (currentUserId === userId) {
    currentOverlay = next;
  }
  return buildLocalProfile(userId, next);
}
