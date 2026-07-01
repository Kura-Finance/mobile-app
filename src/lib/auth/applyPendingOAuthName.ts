import type { User } from '@privy-io/expo';
import type { UserProfileV1 } from '../api/auth/schemas';
import Logger from '../../shared/utils/Logger';
import {
  consumePendingAppleDisplayName,
  extractGoogleDisplayName,
  getPendingAppleDisplayName,
  syncOAuthDisplayNameIfNeeded,
} from './oauthDisplayName';

/**
 * After Privy → Kura login, persist the OAuth-provided name on the Kura profile
 * when the backend account has no display name yet.
 */
export async function applyPendingOAuthDisplayName(
  profile: UserProfileV1,
  privyUser?: User | null,
): Promise<UserProfileV1> {
  const pendingAppleName = getPendingAppleDisplayName();
  const googleName = extractGoogleDisplayName(privyUser);
  const candidateName = pendingAppleName ?? googleName;

  if (!candidateName) {
    return profile;
  }

  try {
    const updated = await syncOAuthDisplayNameIfNeeded(profile, candidateName);
    if (pendingAppleName) consumePendingAppleDisplayName();
    if (updated.id === profile.id && updated.displayName !== profile.displayName) {
      Logger.info('OAuthDisplayName', 'Applied OAuth display name', {
        source: pendingAppleName ? 'apple' : 'google',
      });
    }
    return updated;
  } catch (err) {
    Logger.warn('OAuthDisplayName', 'Failed to apply OAuth display name', {
      error: err instanceof Error ? err.message : String(err),
    });
    return profile;
  }
}
