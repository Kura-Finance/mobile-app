import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../../shared/store/useAppStore';
import { hasAppBackend } from '../../../config/env';
import {
  getWaitlistStatus,
  joinWaitlist,
  type WaitlistProduct,
} from '../../../lib/api/waitlist';

const STATUS_CACHE_TTL_MS = 5 * 60 * 1000;
const statusCache = new Map<string, { joined: boolean; expiresAt: number }>();

function statusCacheKey(email: string, product: WaitlistProduct): string {
  return `${email.toLowerCase()}:${product}`;
}

function readCachedStatus(email: string, product: WaitlistProduct): boolean | null {
  const hit = statusCache.get(statusCacheKey(email, product));
  if (!hit || hit.expiresAt <= Date.now()) return null;
  return hit.joined;
}

function writeCachedStatus(email: string, product: WaitlistProduct, joined: boolean): void {
  statusCache.set(statusCacheKey(email, product), {
    joined,
    expiresAt: Date.now() + STATUS_CACHE_TTL_MS,
  });
}

export interface UseWaitlistJoinOptions {
  /** When false, skip the initial status lookup (call when UI is visible). */
  enabled?: boolean;
}

export function useWaitlistJoin(
  product: WaitlistProduct,
  options?: UseWaitlistJoinOptions,
) {
  const enabled = options?.enabled ?? true;
  const email = useAppStore((s) => s.userProfile.email);
  const emailIsPlaceholder = useAppStore((s) => s.userProfile.emailIsPlaceholder);
  const displayName = useAppStore((s) => s.userProfile.displayName);

  const hasRealEmail = Boolean(email?.trim()) && !emailIsPlaceholder;
  const [joined, setJoined] = useState(false);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!enabled || !hasAppBackend() || !hasRealEmail) {
      setJoined(false);
      setChecking(false);
      return;
    }

    const cached = readCachedStatus(email, product);
    if (cached !== null) {
      setJoined(cached);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    void getWaitlistStatus(email, product)
      .then((status) => {
        if (cancelled) return;
        writeCachedStatus(email, product, status.joined);
        setJoined(status.joined);
      })
      .catch(() => {
        if (!cancelled) setJoined(false);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, email, hasRealEmail, product]);

  const join = useCallback(async () => {
    if (!hasAppBackend()) {
      throw new Error('WAITLIST_UNAVAILABLE');
    }
    if (!hasRealEmail) {
      throw new Error('EMAIL_REQUIRED');
    }

    setSubmitting(true);
    try {
      const result = await joinWaitlist({
        email,
        product,
        name: displayName.trim() || undefined,
        source: 'mobile_app',
      });
      writeCachedStatus(email, product, true);
      setJoined(true);
      return result;
    } finally {
      setSubmitting(false);
    }
  }, [displayName, email, hasRealEmail, product]);

  return {
    join,
    joined,
    checking,
    submitting,
    hasRealEmail,
    backendAvailable: hasAppBackend(),
  };
}
