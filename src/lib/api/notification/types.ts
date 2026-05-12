/**
 * Plaintext (UI-friendly) notification types.
 *
 * `NotificationRecord` is the wire shape verbatim. The UI helpers below add
 * common derived predicates so screens don't repeat the same logic.
 */

import type { NotificationCategory, NotificationRecordV1 } from './schemas';

export type Notification = NotificationRecordV1;

export function isUnread(notification: Notification): boolean {
  return notification.status !== 'read';
}

export function categoryFallbackIcon(category: NotificationCategory): string {
  switch (category) {
    case 'price_alert':
      return 'trending-up';
    case 'account_activity':
      return 'person';
    case 'transaction':
      return 'swap-horizontal';
    case 'system_alert':
      return 'information-circle';
    case 'security':
      return 'shield-checkmark';
    default:
      return 'notifications';
  }
}

export function categoryAccentColor(category: NotificationCategory): string {
  switch (category) {
    case 'price_alert':
      return '#F59E0B';
    case 'account_activity':
      return '#3B82F6';
    case 'transaction':
      return '#4ADE80';
    case 'system_alert':
      return '#8B5CF6';
    case 'security':
      return '#EF4444';
    default:
      return '#6B7280';
  }
}
