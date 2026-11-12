/**
 * Local (no-backend) session — pure helpers.
 *
 * When EXPO_PUBLIC_API_BASE_URL is empty the app runs without an app backend:
 * the Privy session IS the app session, and the user profile is derived from
 * the Privy user plus a small on-device overlay (display name / avatar).
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

/** Mirrors the backend convention: users without a linked email get a placeholder. */
const PLACEHOLDER_EMAIL = 'not-linked@placeholder.invalid';

const MAX_DISPLAY_NAME_LENGTH = 50;

/** On-device profile fields the backend used to store. */
export interface LocalProfileOverlay {
  displayName?: string;
  avatarUrl?: string;
}

interface LinkedAccountLike {
  type: string;
  address?: unknown;
  email?: unknown;
  name?: unknown;
}

/** Structural subset of the Privy `User` this module reads. */
export interface PrivyUserLike {
  id: string;
  linked_accounts?: readonly LinkedAccountLike[] | null;
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Linked email address: email login first, then Google / Apple OAuth. */
export function resolvePrivyEmail(user: PrivyUserLike): string | null {
  const accounts = user.linked_accounts ?? [];
  const emailAccount = accounts.find((a) => a.type === 'email');
  const fromEmail = nonEmptyString(emailAccount?.address);
  if (fromEmail) return fromEmail.toLowerCase();

  for (const type of ['google_oauth', 'apple_oauth']) {
    const account = accounts.find((a) => a.type === type);
    const fromOAuth = nonEmptyString(account?.email);
    if (fromOAuth) return fromOAuth.toLowerCase();
  }
  return null;
}

function resolvePrivyDisplayName(user: PrivyUserLike): string | null {
  const google = (user.linked_accounts ?? []).find((a) => a.type === 'google_oauth');
  return nonEmptyString(google?.name);
}

/**
 * Build the app profile from a Privy user. Backend-only fields (membership,
 * referrals, cashback) are left empty.
 */
export function buildLocalProfile(
  user: PrivyUserLike,
  overlay: LocalProfileOverlay = {},
): UserProfileV1 {
  const email = resolvePrivyEmail(user);
  const displayName = (
    nonEmptyString(overlay.displayName) ??
    resolvePrivyDisplayName(user) ??
    ''
  ).slice(0, MAX_DISPLAY_NAME_LENGTH);

  return {
    id: user.id,
    email: email ?? PLACEHOLDER_EMAIL,
    emailIsPlaceholder: email === null,
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
