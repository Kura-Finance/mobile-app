/**
 * Local (no-backend) session state.
 *
 * Holds the current Privy user and the on-device profile overlay so the app
 * store can build a profile without calling `/api/auth/me`. Only used when
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
  type PrivyUserLike,
} from './localSessionCore';

export { LOCAL_SESSION_TOKEN } from './localSessionCore';

const OVERLAY_KEY_PREFIX = '@kura/localProfile/';

let currentUser: PrivyUserLike | null = null;
let currentOverlay: LocalProfileOverlay = {};
/** Resolves once the overlay for {@link currentUser} has been read from disk. */
let overlayLoaded: Promise<void> = Promise.resolve();

/** True when no app backend is configured: the Privy session is the app session. */
export function isLocalSessionMode(): boolean {
  return !hasAppBackend();
}

function overlayKey(userId: string): string {
  return `${OVERLAY_KEY_PREFIX}${userId}`;
}

/**
 * Point the local session at the signed-in Privy user (or `null` on sign-out).
 * The user is bound synchronously; its on-device overlay loads in the
 * background — read the result with {@link loadLocalProfile}.
 */
export function bindLocalSessionUser(user: PrivyUserLike | null): void {
  if (!user) {
    currentUser = null;
    currentOverlay = {};
    overlayLoaded = Promise.resolve();
    return;
  }

  const userChanged = currentUser?.id !== user.id;
  currentUser = user;
  if (!userChanged) return;

  currentOverlay = {};
  overlayLoaded = AsyncStorage.getItem(overlayKey(user.id))
    .then((raw) => {
      if (currentUser?.id === user.id) {
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
 * Profile for the bound Privy user once its overlay has loaded, or `null`
 * when nobody is signed in.
 */
export async function loadLocalProfile(): Promise<UserProfileV1 | null> {
  await overlayLoaded;
  return currentUser ? buildLocalProfile(currentUser, currentOverlay) : null;
}

/** Persist display name / avatar on this device and return the updated profile. */
export async function updateLocalProfileOverlay(
  patch: LocalProfileOverlay,
): Promise<UserProfileV1> {
  await overlayLoaded;
  const user = currentUser;
  if (!user) throw new Error('Not signed in');

  const next: LocalProfileOverlay = { ...currentOverlay, ...patch };
  await AsyncStorage.setItem(overlayKey(user.id), JSON.stringify(next));
  if (currentUser?.id === user.id) {
    currentOverlay = next;
  }
  return buildLocalProfile(user, next);
}
