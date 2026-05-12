/**
 * Notification HTTP client.
 *
 * Endpoints (all envelope-wrapped, all require auth):
 *   GET    /api/notifications              ?limit & offset & status & category & startDate & endDate
 *   PATCH  /api/notifications/:id/read
 *   DELETE /api/notifications/:id
 *   PATCH  /api/notifications/batch/read   { ids: string[] }
 *   DELETE /api/notifications/all
 *   GET    /api/notifications/preferences
 *   PATCH  /api/notifications/preferences  partial<NotificationPreferences>
 *   POST   /api/notifications/send         { types?, category, title, message, ... }
 *
 * `POST /send` is admin-style and not exposed for general UI but kept here
 * for completeness so settings test screens can fire test pushes.
 */

import { requestJson } from '../client';
import {
  batchReadResponseSchema,
  deleteNotificationResponseSchema,
  markAsReadResponseSchema,
  notificationListResponseSchema,
  notificationPreferencesSchema,
  preferencesResponseSchema,
  type BatchReadResponseV1,
  type NotificationCategory,
  type NotificationListResponseV1,
  type NotificationPreferencesV1,
  type NotificationStatus,
} from './schemas';
import type { Notification } from './types';

const apiName = 'NotificationApi';

export interface FetchNotificationsParams {
  limit?: number;
  offset?: number;
  status?: NotificationStatus;
  category?: NotificationCategory;
  startDate?: string;
  endDate?: string;
}

function buildListQuery(params: FetchNotificationsParams): string {
  const query = new URLSearchParams();
  if (typeof params.limit === 'number') {
    if (params.limit < 1 || params.limit > 100) {
      throw new Error('limit must be 1..100');
    }
    query.set('limit', String(params.limit));
  }
  if (typeof params.offset === 'number') {
    if (params.offset < 0) throw new Error('offset must be >= 0');
    query.set('offset', String(params.offset));
  }
  if (params.status) query.set('status', params.status);
  if (params.category) query.set('category', params.category);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  return query.size > 0 ? `?${query.toString()}` : '';
}

export async function fetchNotifications(
  params: FetchNotificationsParams = {},
): Promise<NotificationListResponseV1> {
  const raw = await requestJson<unknown>(`/api/notifications${buildListQuery(params)}`, {
    method: 'GET',
    apiName,
  });
  return notificationListResponseSchema.parse(raw);
}

export async function markNotificationAsRead(id: string): Promise<Notification> {
  if (!id) throw new Error('notification id is required');
  const raw = await requestJson<unknown>(`/api/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    apiName,
  });
  return markAsReadResponseSchema.parse(raw).notification;
}

export async function deleteNotification(id: string): Promise<{ message: string }> {
  if (!id) throw new Error('notification id is required');
  const raw = await requestJson<unknown>(`/api/notifications/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    apiName,
  });
  return deleteNotificationResponseSchema.parse(raw);
}

export async function markNotificationsBatchAsRead(ids: string[]): Promise<BatchReadResponseV1> {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('ids must be a non-empty array');
  }
  const raw = await requestJson<unknown>('/api/notifications/batch/read', {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
    apiName,
  });
  return batchReadResponseSchema.parse(raw);
}

export async function clearAllNotifications(): Promise<{ message: string }> {
  return requestJson<{ message: string }>('/api/notifications/all', {
    method: 'DELETE',
    apiName,
  });
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferencesV1> {
  const raw = await requestJson<unknown>('/api/notifications/preferences', {
    method: 'GET',
    apiName,
  });
  return preferencesResponseSchema.parse(raw).preferences;
}

export async function updateNotificationPreferences(
  partial: Partial<NotificationPreferencesV1>,
): Promise<NotificationPreferencesV1> {
  const keys = Object.keys(partial).filter((k) => partial[k as keyof typeof partial] !== undefined);
  if (keys.length === 0) {
    throw new Error('updateNotificationPreferences: at least one field is required');
  }
  const raw = await requestJson<unknown>('/api/notifications/preferences', {
    method: 'PATCH',
    body: JSON.stringify(partial),
    apiName,
  });
  // Backend returns the full preferences blob — validate it on the way back.
  const parsed = preferencesResponseSchema.parse(raw);
  return notificationPreferencesSchema.parse(parsed.preferences);
}
