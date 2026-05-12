import type { UserProfileV1 } from './schemas';

type EmailProfile = Pick<UserProfileV1, 'email' | 'emailIsPlaceholder'>;

/** UI label — hides internal placeholder addresses. */
export function displayEmail(user: EmailProfile, notLinkedLabel: string): string {
  return user.emailIsPlaceholder ? notLinkedLabel : user.email;
}

export function isRealEmail(user: Pick<UserProfileV1, 'emailIsPlaceholder'>): boolean {
  return !user.emailIsPlaceholder;
}

export function needsEmailLink(user: Pick<UserProfileV1, 'emailIsPlaceholder'>): boolean {
  return user.emailIsPlaceholder;
}

export function hasVerifiedEmail(user: Pick<UserProfileV1, 'emailIsPlaceholder'>): boolean {
  return !user.emailIsPlaceholder;
}
