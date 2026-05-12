import { describe, expect, test } from 'vitest';
import {
  batchReadResponseSchema,
  notificationListResponseSchema,
  notificationPreferencesSchema,
  notificationRecordSchema,
  preferencesResponseSchema,
} from '../schemas';
import { categoryAccentColor, categoryFallbackIcon, isUnread } from '../types';

const sampleRecord = {
  id: 'n-1',
  userId: 'u-1',
  type: 'push',
  category: 'price_alert',
  subject: 'BTC up',
  title: 'BTC +5%',
  message: 'Bitcoin is up 5% in the last hour',
  data: { symbol: 'BTC' },
  actionUrl: null,
  priority: 'high',
  status: 'sent',
  sentAt: '2026-05-12T01:00:00Z',
  deliveredAt: null,
  readAt: null,
  failureReason: null,
  createdAt: '2026-05-12T00:59:59Z',
  updatedAt: '2026-05-12T01:00:00Z',
};

describe('notificationRecordSchema', () => {
  test('parses a canonical wire record', () => {
    expect(() => notificationRecordSchema.parse(sampleRecord)).not.toThrow();
  });

  test('rejects unknown category', () => {
    expect(() =>
      notificationRecordSchema.parse({ ...sampleRecord, category: 'unknown_category' }),
    ).toThrow();
  });

  test('rejects unknown status', () => {
    expect(() => notificationRecordSchema.parse({ ...sampleRecord, status: 'archived' })).toThrow();
  });
});

describe('notificationListResponseSchema', () => {
  test('parses paginated list', () => {
    const out = notificationListResponseSchema.parse({
      notifications: [sampleRecord],
      total: 1,
      limit: 50,
      offset: 0,
    });
    expect(out.notifications).toHaveLength(1);
    expect(out.total).toBe(1);
  });
});

describe('notificationPreferencesSchema', () => {
  test('all backend fields', () => {
    const out = notificationPreferencesSchema.parse({
      userId: 'u-1',
      enableEmailNotifications: true,
      enablePushNotifications: false,
      enableInAppNotifications: true,
      priceAlertThreshold: 7,
      accountActivityAlerts: true,
      transactionAlerts: true,
      systemAlerts: false,
      securityAlerts: true,
      unsubscribeAll: false,
    });
    expect(out.priceAlertThreshold).toBe(7);
  });

  test('rejects out-of-range priceAlertThreshold', () => {
    expect(() =>
      notificationPreferencesSchema.parse({
        enableEmailNotifications: true,
        enablePushNotifications: true,
        enableInAppNotifications: true,
        priceAlertThreshold: 150,
        accountActivityAlerts: true,
        transactionAlerts: true,
        systemAlerts: true,
        securityAlerts: true,
        unsubscribeAll: false,
      }),
    ).toThrow();
  });

  test('preferencesResponseSchema wraps the blob', () => {
    expect(() =>
      preferencesResponseSchema.parse({
        preferences: {
          enableEmailNotifications: true,
          enablePushNotifications: true,
          enableInAppNotifications: true,
          priceAlertThreshold: 5,
          accountActivityAlerts: true,
          transactionAlerts: true,
          systemAlerts: true,
          securityAlerts: true,
          unsubscribeAll: false,
        },
        message: 'Preferences updated',
      }),
    ).not.toThrow();
  });
});

describe('batchReadResponseSchema', () => {
  test('parses success counts', () => {
    expect(
      batchReadResponseSchema.parse({ hasSuccess: true, markedCount: 3, failedCount: 0 }),
    ).toEqual({ hasSuccess: true, markedCount: 3, failedCount: 0 });
  });
});

describe('isUnread', () => {
  test('non-read statuses count as unread', () => {
    for (const status of ['pending', 'sent', 'delivered', 'failed'] as const) {
      expect(isUnread({ ...sampleRecord, status })).toBe(true);
    }
  });

  test('read status returns false', () => {
    expect(isUnread({ ...sampleRecord, status: 'read' })).toBe(false);
  });
});

describe('category helpers', () => {
  test('each category gets a distinct icon + color', () => {
    const cats = ['price_alert', 'account_activity', 'transaction', 'system_alert', 'security'] as const;
    const icons = new Set(cats.map(categoryFallbackIcon));
    const colors = new Set(cats.map(categoryAccentColor));
    expect(icons.size).toBe(cats.length);
    expect(colors.size).toBe(cats.length);
  });
});
