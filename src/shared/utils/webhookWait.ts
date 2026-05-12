import Logger from './Logger';
import { getPlaidCacheInfo } from '../../lib/api/plaid';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Utility function for webhook wait pattern
 * Use in Zustand stores or other non-hook contexts
 * 
 * After connecting/disconnecting an account:
 * 1. Wait for webhook to trigger
 * 2. Poll with exponential backoff
 * 3. Returns when ready for data refresh
 */
export async function waitForWebhookCompletion(action: 'connect' | 'disconnect'): Promise<void> {
  Logger.info('webhookWait', `Waiting for webhook: ${action} account`);

  // Step 1: Initial wait (1-2 seconds for webhook to trigger)
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Step 2: Exponential backoff polling (4 attempts, ~3.5 seconds total)
  const pollIntervals = [500, 700, 1000, 1300];
  for (let i = 0; i < pollIntervals.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, pollIntervals[i]));
    Logger.debug('webhookWait', `Poll attempt ${i + 1}/${pollIntervals.length} for ${action}`);
  }

  Logger.info('webhookWait', `Webhook wait complete for ${action}, ready to refresh data`);
}

/**
 * Poll the backend's Plaid cache-info endpoint until a newly connected item has
 * actually been synced server-side (Plaid pulls accounts/balances via webhooks,
 * which can take well beyond a fixed few-second wait).
 *
 * Readiness signal: `cachedAccounts` grows past the baseline (the count we had
 * before the connect). Returns as soon as that happens, or after `maxWaitMs`.
 *
 * NOTE: this only requires the auth token (no crypto session), since cache-info
 * is plaintext stats — decryption happens later during hydration.
 */
export async function waitForPlaidAccountsSynced(opts: {
  baselineAccountCount: number;
  maxWaitMs?: number;
}): Promise<boolean> {
  const { baselineAccountCount, maxWaitMs = 60_000 } = opts;
  const startedAt = Date.now();

  // Give the webhook a moment to even fire before the first poll.
  await delay(1500);

  // Backoff schedule (ms); the last value repeats until the budget is exhausted.
  const intervals = [1000, 1500, 2000, 2500, 3000, 4000, 5000];
  let attempt = 0;

  while (Date.now() - startedAt < maxWaitMs) {
    try {
      const info = await getPlaidCacheInfo();
      const synced = info.cacheStats.cachedAccounts;
      Logger.debug('webhookWait', 'Plaid sync poll', {
        attempt: attempt + 1,
        cachedAccounts: synced,
        baseline: baselineAccountCount,
      });
      if (synced > baselineAccountCount) {
        Logger.info('webhookWait', 'Plaid accounts synced server-side', {
          cachedAccounts: synced,
          waitedMs: Date.now() - startedAt,
        });
        return true;
      }
    } catch (error) {
      Logger.warn('webhookWait', 'Plaid cache-info poll failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    await delay(intervals[Math.min(attempt, intervals.length - 1)]);
    attempt += 1;
  }

  Logger.warn('webhookWait', 'Timed out waiting for Plaid accounts to sync', {
    baseline: baselineAccountCount,
    maxWaitMs,
  });
  return false;
}
