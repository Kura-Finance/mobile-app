/**
 * Refresh broker exchange holdings after TrackFi unlock (crypto session restored).
 */

import { getCryptoSession } from '../../../lib/crypto/session';
import { useExchangeStore } from '../../../shared/store/useExchangeStore';
import Logger from '../../../shared/utils/Logger';

const TAG = 'TrackFiBrokerRefresh';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCryptoSession(maxAttempts = 40, delayMs = 100): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    if (getCryptoSession()) return true;
    await sleep(delayMs);
  }
  return getCryptoSession() != null;
}

export async function refreshTrackFiBrokerData(
  authToken: string,
  options?: { force?: boolean },
): Promise<void> {
  const force = options?.force ?? true;

  const exchangeStore = useExchangeStore.getState();
  let exchangeAccounts = exchangeStore.exchangeAccounts;

  if (exchangeAccounts.length === 0) {
    try {
      await exchangeStore.hydrateExchangeAccounts(authToken);
      exchangeAccounts = useExchangeStore.getState().exchangeAccounts;
    } catch (error) {
      Logger.warn(TAG, 'Failed to hydrate exchange accounts', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (exchangeAccounts.length === 0) return;

  const sessionReady = await waitForCryptoSession();
  if (!sessionReady) {
    Logger.warn(TAG, 'Crypto session not ready — skipping exchange balance refresh');
    return;
  }

  const { fetchExchangeBalances } = useExchangeStore.getState();
  await Promise.all(
    exchangeAccounts.map((account) =>
      fetchExchangeBalances(account.id, authToken, force).catch((error) => {
        Logger.warn(TAG, 'Exchange balance refresh failed', {
          accountId: account.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }),
    ),
  );
}
