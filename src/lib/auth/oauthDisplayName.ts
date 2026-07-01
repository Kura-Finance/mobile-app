/**
 * OAuth display-name helpers for Sign in with Apple / Google.
 *
 * Apple only returns the user's name on the first authorization. Privy exposes
 * it via `onAppleOAuthUserInfo`; we hold it briefly until the Kura login
 * exchange completes, then PATCH the profile automatically.
 */

import type { AppleAuthenticationFullName } from 'expo-apple-authentication';
import type { User } from '@privy-io/expo';
import type { UserProfileV1 } from '../api/auth/schemas';
import { updateDisplayName } from '../api/auth/me';

let pendingAppleDisplayName: string | null = null;

export function setPendingAppleDisplayName(name: string): void {
  const trimmed = name.trim();
  pendingAppleDisplayName = trimmed.length > 0 ? trimmed.slice(0, 50) : null;
}

export function getPendingAppleDisplayName(): string | null {
  return pendingAppleDisplayName;
}

export function consumePendingAppleDisplayName(): string | null {
  const name = pendingAppleDisplayName;
  pendingAppleDisplayName = null;
  return name;
}

export function formatAppleFullName(
  fullName: AppleAuthenticationFullName | null | undefined,
): string | null {
  if (!fullName) return null;

  const parts = [fullName.givenName, fullName.middleName, fullName.familyName]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());

  if (parts.length === 0) {
    const nickname =
      typeof fullName.nickname === 'string' && fullName.nickname.trim().length > 0
        ? fullName.nickname.trim()
        : null;
    return nickname ? nickname.slice(0, 50) : null;
  }

  return parts.join(' ').slice(0, 50);
}

export function extractGoogleDisplayName(user: User | null | undefined): string | null {
  const account = user?.linked_accounts?.find((a) => a.type === 'google_oauth');
  if (!account || account.type !== 'google_oauth') return null;
  const name = 'name' in account && typeof account.name === 'string' ? account.name.trim() : '';
  return name.length > 0 ? name.slice(0, 50) : null;
}

export function profileNeedsDisplayName(profile: Pick<UserProfileV1, 'displayName' | 'hasName'>): boolean {
  return !profile.hasName || profile.displayName.trim().length === 0;
}

export function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const trimmed = displayName.trim();
  if (!trimmed) return { firstName: '', lastName: '' };

  const space = trimmed.indexOf(' ');
  if (space <= 0) return { firstName: trimmed, lastName: '' };

  return {
    firstName: trimmed.slice(0, space),
    lastName: trimmed.slice(space + 1).trim(),
  };
}

/**
 * Apply a name obtained from OAuth (Apple first-login credential or Google
 * linked account) when the Kura profile still has no display name.
 */
export async function syncOAuthDisplayNameIfNeeded(
  profile: UserProfileV1,
  candidateName: string | null | undefined,
): Promise<UserProfileV1> {
  const name = candidateName?.trim().slice(0, 50);
  if (!name || !profileNeedsDisplayName(profile)) {
    return profile;
  }
  return updateDisplayName(name);
}
