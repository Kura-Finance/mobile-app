/**
 * Re-export from the new lib for legacy code paths.
 *
 * The store now holds `Notification` / `NotificationPreferences` shapes
 * straight from the wire; UI never has to translate from a custom mobile
 * type to the backend one.
 */

export type {
  Notification,
  NotificationCategory,
  NotificationStatus,
} from '../../../lib/api/notification';
export type {
  NotificationPreferencesV1 as NotificationPreferences,
  NotificationPriority,
  NotificationType,
} from '../../../lib/api/notification';

import type {
  Notification,
  NotificationPreferencesV1 as NotificationPreferences,
} from '../../../lib/api/notification';

export interface NotificationState {
  notifications: Notification[];
  preferences: NotificationPreferences | null;
  isLoading: boolean;
  error: string | null;
  unreadCount: number;
  lastFetchedAt: number | null;
}
