/**
 * useCardStatus
 *
 * Fetches and manages the Card + KYC status from the Kura backend.
 * Poll-friendly: call `refresh()` after any KYC/card action to get
 * the latest state without unmounting.
 *
 * Status machine:
 *
 *   not_started → (startKyc) → pending / under_review
 *                                  ↓
 *                              approved  →  card.status: applying → issued → active
 *                              rejected  →  show rejection UI
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchCardStatus,
  freezeCard,
  unfreezeCard,
  type CardStatusResponse,
  type KycStatus,
  type CardStatus,
} from '../../../lib/api/card';
import Logger from '../../../shared/utils/Logger';
import i18n from '../../../shared/locales/i18n';

export type CardLoadState = 'loading' | 'ready' | 'error';

export interface UseCardStatusReturn {
  loadState: CardLoadState;
  kyc: CardStatusResponse['kyc'] | null;
  card: CardStatusResponse['card'] | null;
  spending: CardStatusResponse['spending'] | null;
  wallet: CardStatusResponse['wallet'] | null;
  /** Derived convenience */
  kycStatus: KycStatus | null;
  cardStatus: CardStatus | null;
  isKycApproved: boolean;
  isCardActive: boolean;
  isCardFrozen: boolean;
  errorMessage: string;
  /** Re-fetch from backend */
  refresh: () => Promise<void>;
  /** Toggle freeze / unfreeze */
  toggleFreeze: () => Promise<void>;
  isFreezeLoading: boolean;
}

export function useCardStatus(authToken: string | null): UseCardStatusReturn {
  const [loadState, setLoadState] = useState<CardLoadState>('loading');
  const [data, setData] = useState<CardStatusResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isFreezeLoading, setIsFreezeLoading] = useState(false);
  const cancelRef = useRef(false);

  const fetchData = useCallback(async () => {
    if (!authToken) {
      setLoadState('error');
      setErrorMessage(i18n.t('card.notAuthenticated'));
      return;
    }
    try {
      setLoadState('loading');
      const result = await fetchCardStatus();
      if (cancelRef.current) return;
      setData(result);
      setLoadState('ready');
    } catch (err) {
      if (cancelRef.current) return;
      const msg = err instanceof Error ? err.message : i18n.t('card.failedLoadCardStatus');
      Logger.warn('useCardStatus', 'Failed to fetch card status', { message: msg });
      setErrorMessage(msg);
      setLoadState('error');
    }
  }, [authToken]);

  useEffect(() => {
    cancelRef.current = false;
    void fetchData();
    return () => { cancelRef.current = true; };
  }, [fetchData]);

  const toggleFreeze = useCallback(async () => {
    if (!data || isFreezeLoading) return;
    setIsFreezeLoading(true);
    try {
      if (data.card.status === 'frozen') {
        await unfreezeCard();
      } else {
        await freezeCard();
      }
      // Refresh to get updated status
      await fetchData();
    } catch (err) {
      Logger.warn('useCardStatus', 'Freeze/unfreeze failed', {
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsFreezeLoading(false);
    }
  }, [data, isFreezeLoading, fetchData]);

  const kycStatus = data?.kyc.status ?? null;
  const cardStatus = data?.card.status ?? null;

  return {
    loadState,
    kyc: data?.kyc ?? null,
    card: data?.card ?? null,
    spending: data?.spending ?? null,
    wallet: data?.wallet ?? null,
    kycStatus,
    cardStatus,
    isKycApproved: kycStatus === 'approved',
    isCardActive: cardStatus === 'active',
    isCardFrozen: cardStatus === 'frozen',
    errorMessage,
    refresh: fetchData,
    toggleFreeze,
    isFreezeLoading,
  };
}
