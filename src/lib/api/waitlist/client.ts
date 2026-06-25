/**
 * Public waitlist endpoints (`/api/waitlist/*`) — no auth required.
 */

import { requestJson } from '../client';
import { normalizeWaitlistProduct } from './products';
import {
  joinWaitlistResponseSchema,
  waitlistCountResponseSchema,
  waitlistStatusResponseSchema,
  type JoinWaitlistResponse,
  type WaitlistCountResponse,
  type WaitlistStatusResponse,
} from './schemas';

const apiName = 'WaitlistApi';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface JoinWaitlistParams {
  email: string;
  product?: string;
  name?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) {
    throw new Error('email must be a valid address');
  }
  return normalized;
}

export async function joinWaitlist(params: JoinWaitlistParams): Promise<JoinWaitlistResponse> {
  const body: Record<string, unknown> = {
    email: normalizeEmail(params.email),
  };
  if (params.product) {
    body.product = normalizeWaitlistProduct(params.product);
  }
  if (params.name?.trim()) {
    const name = params.name.trim();
    if (name.length < 1 || name.length > 120) {
      throw new Error('name must be 1–120 characters');
    }
    body.name = name;
  }
  if (params.source?.trim()) {
    body.source = params.source.trim();
  }
  if (params.metadata && Object.keys(params.metadata).length > 0) {
    body.metadata = params.metadata;
  }

  const raw = await requestJson<unknown>('/api/waitlist', {
    method: 'POST',
    skipAuth: true,
    body: JSON.stringify(body),
    apiName,
  });
  return joinWaitlistResponseSchema.parse(raw);
}

export async function getWaitlistStatus(
  email: string,
  product?: string,
): Promise<WaitlistStatusResponse> {
  const query = new URLSearchParams({ email: normalizeEmail(email) });
  if (product) {
    query.set('product', normalizeWaitlistProduct(product));
  }
  const raw = await requestJson<unknown>(`/api/waitlist/status?${query.toString()}`, {
    method: 'GET',
    skipAuth: true,
    apiName,
  });
  return waitlistStatusResponseSchema.parse(raw);
}

export async function getWaitlistCount(product?: string): Promise<WaitlistCountResponse> {
  const query = new URLSearchParams();
  if (product) {
    query.set('product', normalizeWaitlistProduct(product));
  }
  const suffix = query.size ? `?${query.toString()}` : '';
  const raw = await requestJson<unknown>(`/api/waitlist/count${suffix}`, {
    method: 'GET',
    skipAuth: true,
    apiName,
  });
  return waitlistCountResponseSchema.parse(raw);
}
