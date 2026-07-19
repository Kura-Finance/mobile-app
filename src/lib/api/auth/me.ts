/**
 * Authenticated user-profile endpoints (`/api/auth/me/*`).
 */

import { requestJson } from '../client';
import { userProfileV1Schema, type UserProfileV1 } from './schemas';

import { z } from 'zod';

const apiName = 'AuthMeApi';

export async function fetchCurrentUserProfile(): Promise<UserProfileV1> {
  const data = await requestJson<{ user: unknown }>('/api/auth/me', {
    method: 'GET',
    apiName,
  });
  return userProfileV1Schema.parse(data.user);
}

export async function updateCurrentUserProfile(
  patch: { displayName?: string; avatarUrl?: string },
): Promise<UserProfileV1> {
  if (!patch.displayName && !patch.avatarUrl) {
    throw new Error('updateCurrentUserProfile: at least one field must be provided');
  }
  const data = await requestJson<{ user: unknown }>('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
    apiName,
  });
  return userProfileV1Schema.parse(data.user);
}

export async function updateDisplayName(displayName: string): Promise<UserProfileV1> {
  if (typeof displayName !== 'string' || displayName.trim().length === 0 || displayName.length > 50) {
    throw new Error('displayName must be a non-empty string up to 50 chars');
  }
  const data = await requestJson<{ user: unknown }>('/api/auth/me/display-name', {
    method: 'PATCH',
    body: JSON.stringify({ displayName }),
    apiName,
  });
  return userProfileV1Schema.parse(data.user);
}

const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

export async function updateAvatar(avatarDataUrl: string): Promise<UserProfileV1> {
  if (typeof avatarDataUrl !== 'string' || avatarDataUrl.trim().length === 0) {
    throw new Error('avatar must be a non-empty data URL');
  }
  if (!avatarDataUrl.startsWith('data:')) {
    throw new Error('avatar must be a data URL (data:image/...)');
  }
  if (avatarDataUrl.length > AVATAR_MAX_BYTES) {
    throw new Error('avatar exceeds 10MB limit');
  }
  const data = await requestJson<{ user: unknown }>('/api/auth/me/avatar', {
    method: 'PATCH',
    body: JSON.stringify({ avatar: avatarDataUrl }),
    apiName,
  });
  return userProfileV1Schema.parse(data.user);
}

const REFERRAL_CODE_PATTERN = /^[A-Z0-9]{4,32}$/;

export async function setReferralCode(referralCode: string): Promise<UserProfileV1> {
  const normalized = referralCode.trim().toUpperCase();
  if (!REFERRAL_CODE_PATTERN.test(normalized)) {
    throw new Error('referralCode must be 4-32 chars [A-Z0-9]');
  }
  const data = await requestJson<{ user: unknown }>('/api/auth/me/referral-code', {
    method: 'POST',
    body: JSON.stringify({ referralCode: normalized }),
    apiName,
  });
  return userProfileV1Schema.parse(data.user);
}

export interface RequestEmailChangeResult {
  message: string;
  expiresIn?: number;
}

export async function requestEmailChange(newEmail: string): Promise<RequestEmailChangeResult> {
  const normalized = newEmail.trim().toLowerCase();
  return requestJson<RequestEmailChangeResult>('/api/auth/me/email/request-change', {
    method: 'POST',
    body: JSON.stringify({ newEmail: normalized }),
    apiName,
  });
}

export async function confirmEmailChange(
  newEmail: string,
  code: string,
): Promise<UserProfileV1> {
  if (!/^\d{6}$/.test(code)) {
    throw new Error('verification code must be a 6-digit numeric string');
  }
  const data = await requestJson<{ user: unknown }>('/api/auth/me/email/verify-change', {
    method: 'POST',
    body: JSON.stringify({ newEmail: newEmail.trim().toLowerCase(), code }),
    apiName,
  });
  return userProfileV1Schema.parse(data.user);
}

export async function deleteCurrentAccount(): Promise<{ message: string }> {
  return requestJson<{ message: string }>('/api/auth/me', {
    method: 'DELETE',
    apiName,
  });
}

export async function logoutCurrentSession(): Promise<{ message: string } | null> {
  try {
    return await requestJson<{ message: string }>('/api/auth/logout', {
      method: 'POST',
      apiName,
    });
  } catch {
    // Mobile keeps state local; logout endpoint is best-effort.
    return null;
  }
}

export type CashbackStatus = 'pending' | 'available' | 'reversed';

export interface CashbackHistoryParams {
  status?: CashbackStatus;
  limit?: number;
}

const cashbackItemSchema = z.object({
  id: z.string(),
  referredUserId: z.string(),
  referredUserEmail: z.string().nullable(),
  stripeInvoiceId: z.string(),
  stripeSubscriptionId: z.string().optional(),
  grossAmount: z.number(),
  cashbackAmount: z.number(),
  currency: z.string(),
  status: z.enum(['pending', 'available', 'reversed']),
  availableAt: z.string(),
  settledAt: z.string().nullable(),
  reversedAt: z.string().nullable(),
  reverseReason: z.string().nullable(),
  createdAt: z.string(),
});
export type CashbackHistoryItem = z.infer<typeof cashbackItemSchema>;

const cashbackSummarySchema = z.object({
  pending: z.number(),
  available: z.number(),
  reversed: z.number(),
  totalEarned: z.number(),
});
export type CashbackHistorySummary = z.infer<typeof cashbackSummarySchema>;

const cashbackHistoryResponseSchema = z.object({
  summary: cashbackSummarySchema,
  items: z.array(cashbackItemSchema),
});

export interface CashbackHistoryResponse {
  summary: CashbackHistorySummary;
  items: CashbackHistoryItem[];
}

export async function fetchCashbackHistory(
  params: CashbackHistoryParams = {},
): Promise<CashbackHistoryResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (typeof params.limit === 'number') {
    if (params.limit < 1 || params.limit > 100) {
      throw new Error('limit must be 1..100');
    }
    query.set('limit', String(params.limit));
  }
  const suffix = query.size ? `?${query.toString()}` : '';
  const raw = await requestJson<unknown>(`/api/auth/me/cashback-history${suffix}`, {
    method: 'GET',
    apiName,
  });
  return cashbackHistoryResponseSchema.parse(raw);
}
