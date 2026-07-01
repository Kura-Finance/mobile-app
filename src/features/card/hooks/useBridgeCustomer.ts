/**
 * Shared Bridge customer fetch — avoids duplicating auth gating + loading state
 * across fiat receive, withdraw, and USDT deposit panels.
 */

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getBridgeCustomer, type BridgeCustomer } from '../../../lib/api/ramp/client';
import { useAppStore } from '../../../shared/store/useAppStore';

export interface UseBridgeCustomerOptions {
  /** When false, skips fetch and clears customer. Default true. */
  enabled?: boolean;
}

export interface UseBridgeCustomerResult {
  customer: BridgeCustomer | null;
  setCustomer: Dispatch<SetStateAction<BridgeCustomer | null>>;
  loadingCustomer: boolean;
  setLoadingCustomer: Dispatch<SetStateAction<boolean>>;
  /** Fetches customer when JWT is present; clears state otherwise. Rethrows API errors. */
  refreshCustomer: () => Promise<BridgeCustomer | null>;
}

export function useBridgeCustomer(
  options: UseBridgeCustomerOptions = {},
): UseBridgeCustomerResult {
  const enabled = options.enabled ?? true;
  const authToken = useAppStore((state) => state.authToken);
  const [customer, setCustomer] = useState<BridgeCustomer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(true);

  const refreshCustomer = useCallback(async (): Promise<BridgeCustomer | null> => {
    if (!useAppStore.getState().authToken) {
      setCustomer(null);
      setLoadingCustomer(false);
      return null;
    }
    setLoadingCustomer(true);
    try {
      const c = await getBridgeCustomer();
      setCustomer(c);
      return c;
    } finally {
      setLoadingCustomer(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoadingCustomer(false);
      return;
    }
    if (authToken) void refreshCustomer();
    else {
      setCustomer(null);
      setLoadingCustomer(false);
    }
  }, [enabled, authToken, refreshCustomer]);

  return {
    customer,
    setCustomer,
    loadingCustomer,
    setLoadingCustomer,
    refreshCustomer,
  };
}
