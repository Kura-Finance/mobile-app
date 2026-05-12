/**
 * Wire schemas for `/api/notifications/*`.
 *
 * Source of truth: BackendServer/src/domains/notification/models/types.ts
 * and `schemas/notificationSchemas.ts`.
 */

import { z } from 'zod';

export const notificationTypeSchema = z.enum(['email', 'push', 'in_app']);
export type NotificationType = z.infer<typeof notificationTypeSchema>;

export const notificationCategorySchema = z.enum([
  'price_alert',
  'account_activity',
  'transaction',
  'system_alert',
  'security',
]);
export type NotificationCategory = z.infer<typeof notificationCategorySchema>;

export const notificationStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'read',
  'failed',
]);
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;

export const notificationPrioritySchema = z.enum(['low', 'normal', 'high']);
export type NotificationPriority = z.infer<typeof notificationPrioritySchema>;

export const notificationRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: notificationTypeSchema,
  category: notificationCategorySchema,
  subject: z.string(),
  title: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
  actionUrl: z.string().nullable().optional(),
  priority: notificationPrioritySchema,
  status: notificationStatusSchema,
  sentAt: z.string().nullable().optional(),
  deliveredAt: z.string().nullable().optional(),
  readAt: z.string().nullable().optional(),
  failureReason: z.string().nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type NotificationRecordV1 = z.infer<typeof notificationRecordSchema>;

export const notificationListResponseSchema = z.object({
  notifications: z.array(notificationRecordSchema),
  total: z.number(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});
export type NotificationListResponseV1 = z.infer<typeof notificationListResponseSchema>;

export const notificationPreferencesSchema = z.object({
  userId: z.string().optional(),
  enableEmailNotifications: z.boolean(),
  enablePushNotifications: z.boolean(),
  enableInAppNotifications: z.boolean(),
  priceAlertThreshold: z.number().min(0).max(100),
  accountActivityAlerts: z.boolean(),
  transactionAlerts: z.boolean(),
  systemAlerts: z.boolean(),
  securityAlerts: z.boolean(),
  unsubscribeAll: z.boolean(),
});
export type NotificationPreferencesV1 = z.infer<typeof notificationPreferencesSchema>;

export const preferencesResponseSchema = z.object({
  preferences: notificationPreferencesSchema,
  message: z.string().optional(),
});

export const batchReadResponseSchema = z.object({
  hasSuccess: z.boolean(),
  markedCount: z.number(),
  failedCount: z.number(),
});
export type BatchReadResponseV1 = z.infer<typeof batchReadResponseSchema>;

export const markAsReadResponseSchema = z.object({
  notification: notificationRecordSchema,
});

export const deleteNotificationResponseSchema = z.object({
  message: z.string(),
});
