/**
 * Local (no-backend) session — pure helpers.
 *
 * When EXPO_PUBLIC_API_BASE_URL is empty the app runs without an app backend
 * and without Privy: having a wallet on this device IS the session, and the
 * profile is just a small on-device overlay (display name / avatar).
 *
 * This file has no React Native imports so it can be unit-tested in Node.
 */

import type { UserProfileV1 } from '../api/auth/schemas';

/**
 * Stand-in for the backend JWT in no-backend mode. It keeps the session-lock
 * machinery (SecureStore persist / biometric restore) working unchanged and is
 * never sent anywhere — there is no backend to send it to.
 */
export const LOCAL_SESSION_TOKEN = 'local-session';

/** The profile schema requires an email; a local wallet has none. */
const PLACEHOLDER_EMAIL = 'not-linked@placeholder.invalid';

const MAX_DISPLAY_NAME_LENGTH = 50;

/** On-device profile fields the backend used to store. */
export interface LocalProfileOverlay {
  displayName?: string;
  avatarUrl?: string;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Stable app user id for the wallet on this device. */
export function localUserId(eoaAddress: string): string {
  return `local:${eoaAddress.toLowerCase()}`;
}

/**
 * Build the app profile for an on-device wallet. There is no account: no
 * email, and backend-only fields (membership, referrals, cashback) stay empty.
 */
export function buildLocalProfile(
  userId: string,
  overlay: LocalProfileOverlay = {},
): UserProfileV1 {
  const displayName = (nonEmptyString(overlay.displayName) ?? '').slice(
    0,
    MAX_DISPLAY_NAME_LENGTH,
  );

  return {
    id: userId,
    email: PLACEHOLDER_EMAIL,
    emailIsPlaceholder: true,
    walletAddress: null,
    displayName,
    hasName: displayName.length > 0,
    avatarUrl: nonEmptyString(overlay.avatarUrl) ?? '',
    membershipLabel: '',
  };
}

/** Tolerant parse of the persisted overlay — bad data yields an empty overlay. */
export function parseLocalProfileOverlay(raw: string | null): LocalProfileOverlay {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const record = parsed as Record<string, unknown>;
    const overlay: LocalProfileOverlay = {};
    const displayName = nonEmptyString(record.displayName);
    const avatarUrl = nonEmptyString(record.avatarUrl);
    if (displayName) overlay.displayName = displayName.slice(0, MAX_DISPLAY_NAME_LENGTH);
    if (avatarUrl) overlay.avatarUrl = avatarUrl;
    return overlay;
  } catch {
    return {};
  }
}
