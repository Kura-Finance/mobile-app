import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '../../../shared/store/useAppStore';
import { hasKuraBackend } from '../../../config/env';
import {
  getWaitlistStatus,
  joinWaitlist,
  type WaitlistProduct,
} from '../../../lib/api/waitlist';

export function useWaitlistJoin(product: WaitlistProduct) {
  const email = useAppStore((s) => s.userProfile.email);
  const emailIsPlaceholder = useAppStore((s) => s.userProfile.emailIsPlaceholder);
  const displayName = useAppStore((s) => s.userProfile.displayName);

  const hasRealEmail = Boolean(email?.trim()) && !emailIsPlaceholder;
  const [joined, setJoined] = useState(false);
  const [checking, setChecking] = useState(hasKuraBackend() && hasRealEmail);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!hasKuraBackend() || !hasRealEmail) {
      setJoined(false);
      setChecking(false);
      return;
    }

    let cancelled = false;
    setChecking(true);
    void getWaitlistStatus(email, product)
      .then((status) => {
        if (!cancelled) setJoined(status.joined);
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
  }, [email, hasRealEmail, product]);

  const join = useCallback(async () => {
    if (!hasKuraBackend()) {
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
    backendAvailable: hasKuraBackend(),
  };
}
