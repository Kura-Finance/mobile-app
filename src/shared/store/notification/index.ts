/**
 * Notification store — async-aware.
 *
 * Wraps `src/lib/api/notification/client.ts` so screens never call the API
 * directly; the store is the single owner of the notification list + cached
 * preferences + unread count derivation.
 */

import { create } from 'zustand';
import {
  clearAllNotifications as clearAllApi,
  deleteNotification as deleteApi,
  fetchNotificationPreferences,
  fetchNotifications,
  isUnread,
  markNotificationAsRead as markReadApi,
  markNotificationsBatchAsRead as markBatchReadApi,
  updateNotificationPreferences,
  type FetchNotificationsParams,
} from '../../../lib/api/notification';
import Logger from '../../utils/Logger';
import type {
  Notification,
  NotificationPreferences,
  NotificationState,
} from './types';

function countUnread(notifications: Notification[]): number {
  return notifications.reduce((sum, n) => (isUnread(n) ? sum + 1 : sum), 0);
}

interface NotificationStore extends NotificationState {
  loadNotifications: (params?: FetchNotificationsParams) => Promise<void>;
  loadPreferences: () => Promise<void>;
  updatePreferences: (patch: Partial<NotificationPreferences>) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markBatchAsRead: (ids: string[]) => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  preferences: null,
  isLoading: false,
  error: null,
  unreadCount: 0,
  lastFetchedAt: null,

  loadNotifications: async (params: FetchNotificationsParams = {}) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetchNotifications({ limit: 50, ...params });
      set({
        notifications: response.notifications,
        unreadCount: countUnread(response.notifications),
        lastFetchedAt: Date.now(),
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load notifications';
      Logger.warn('NotificationStore', 'loadNotifications failed', { message });
      set({ error: message, isLoading: false });
    }
  },

  loadPreferences: async () => {
    try {
      const preferences = await fetchNotificationPreferences();
      set({ preferences });
    } catch (error) {
      Logger.warn('NotificationStore', 'loadPreferences failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },

  updatePreferences: async (patch) => {
    const next = await updateNotificationPreferences(patch);
    set({ preferences: next });
  },

  markAsRead: async (id) => {
    // Optimistic update first.
    const before = get().notifications;
    const optimistic = before.map((n) =>
      n.id === id ? { ...n, status: 'read' as const, readAt: new Date().toISOString() } : n,
    );
    set({ notifications: optimistic, unreadCount: countUnread(optimistic) });

    try {
      const updated = await markReadApi(id);
      set((state) => {
        const next = state.notifications.map((n) => (n.id === id ? updated : n));
        return { notifications: next, unreadCount: countUnread(next) };
      });
    } catch (error) {
      set({ notifications: before, unreadCount: countUnread(before) });
      throw error;
    }
  },

  markBatchAsRead: async (ids) => {
    if (ids.length === 0) return;
    const result = await markBatchReadApi(ids);
    if (result.markedCount === 0) {
      Logger.warn('NotificationStore', 'batch read: no notifications marked', result);
      return;
    }
    set((state) => {
      const set_ = new Set(ids);
      const next = state.notifications.map((n) =>
        set_.has(n.id)
          ? { ...n, status: 'read' as const, readAt: new Date().toISOString() }
          : n,
      );
      return { notifications: next, unreadCount: countUnread(next) };
    });
  },

  removeNotification: async (id) => {
    const before = get().notifications;
    const optimistic = before.filter((n) => n.id !== id);
    set({ notifications: optimistic, unreadCount: countUnread(optimistic) });
    try {
      await deleteApi(id);
    } catch (error) {
      set({ notifications: before, unreadCount: countUnread(before) });
      throw error;
    }
  },

  clearAll: async () => {
    const before = get().notifications;
    set({ notifications: [], unreadCount: 0 });
    try {
      await clearAllApi();
    } catch (error) {
      set({ notifications: before, unreadCount: countUnread(before) });
      throw error;
    }
  },

  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
}));
