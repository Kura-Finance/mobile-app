/**
 * Periodic TrackFi backend sync while the passkey gate is unlocked.
 *
 * Automatic fetches elsewhere (screen mounts, exchange hydrate) are throttled
 * via `trackFiSyncPolicy`; this hook is the single 1-hour polling loop.
 */

import { useCallback, useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { TRACKFI_AUTO_SYNC_INTERVAL_MS } from '../config/trackFiSync';
import {
  markTrackFiSynced,
  shouldAutoSyncTrackFi,
} from '../utils/trackFiSyncPolicy';
import { useAppStore } from '../../../shared/store/useAppStore';
import { useFinanceStore } from '../../../shared/store/finance';
import { useExchangeStore } from '../../../shared/store/useExchangeStore';
import { refreshTrackFiBrokerData } from '../utils/refreshTrackFiBrokerData';
import Logger from '../../../shared/utils/Logger';

const TAG = 'TrackFiBackgroundSync';

interface Options {
  /** True while TrackFi passkey session is unlocked. */
  enabled: boolean;
  /** Bumps on each unlock — triggers an immediate sync when stale. */
  unlockSeq: number;
}

export function useTrackFiBackgroundSync({ enabled, unlockSeq }: Options): void {
  const syncInFlightRef = useRef(false);

  const syncAll = useCallback(async (force: boolean) => {
    if (syncInFlightRef.current) return;

    const authToken = useAppStore.getState().authToken;
    if (!authToken) return;

    const needsPlaid = shouldAutoSyncTrackFi('plaid', { force });
    const needsHistory = shouldAutoSyncTrackFi('assetHistory', { force });
    const exchangeAccountsSnapshot = useExchangeStore.getState().exchangeAccounts;
    const needsBrokerRefresh =
      force ||
      exchangeAccountsSnapshot.length === 0 ||
      exchangeAccountsSnapshot.some((account) =>
        shouldAutoSyncTrackFi('exchange', { key: account.id, force }),
      );

    if (!force && !needsPlaid && !needsHistory && !needsBrokerRefresh) {
      return;
    }

    syncInFlightRef.current = true;
    try {
      const { hydratePlaidFinanceData, hydrateAssetHistory } = useFinanceStore.getState();

      if (needsPlaid) {
        Logger.debug(TAG, 'Syncing Plaid snapshot', { force });
        await hydratePlaidFinanceData(authToken, force);
        markTrackFiSynced('plaid');
      }

      if (needsHistory) {
        Logger.debug(TAG, 'Syncing asset history', { force });
        await hydrateAssetHistory(undefined, force);
        markTrackFiSynced('assetHistory');
      }

      if (needsBrokerRefresh) {
        Logger.debug(TAG, 'Syncing broker holdings', { force });
        await refreshTrackFiBrokerData(authToken, { force });
      }
    } catch (error) {
      Logger.warn(TAG, 'Background sync failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      syncInFlightRef.current = false;
    }
  }, []);

  const prevUnlockSeqRef = useRef(0);

  // Initial sync after unlock (force on fresh unlock; otherwise respect 1h throttle).
  useEffect(() => {
    if (!enabled) {
      prevUnlockSeqRef.current = 0;
      return;
    }
    const force = unlockSeq > 0 && unlockSeq !== prevUnlockSeqRef.current;
    prevUnlockSeqRef.current = unlockSeq;
    void syncAll(force);
  }, [enabled, unlockSeq, syncAll]);

  // Hourly polling while unlocked and app is active.
  useEffect(() => {
    if (!enabled) return;

    const intervalId = setInterval(() => {
      if (AppState.currentState !== 'active') return;
      void syncAll(false);
    }, TRACKFI_AUTO_SYNC_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [enabled, syncAll]);

  // Foreground resume — sync if the hour window has elapsed.
  useEffect(() => {
    if (!enabled) return;

    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        void syncAll(false);
      }
    });

    return () => subscription.remove();
  }, [enabled, syncAll]);
}
