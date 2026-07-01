/**
 * Bridge activity poll intervals — slightly longer than BackendServer deposit sync TTLs
 * (see BackendServer lazyUpdate: BRIDGE_DEPOSITS_*_SYNC_MIN_INTERVAL_MS) so client polls
 * do not outpace backend cache and upstream Bridge rate limits.
 *
 * Payout drains have no backend cache; use the slowest pending interval.
 */

/** Backend default pending deposit sync: 30s */
export const BRIDGE_POLL_DEPOSIT_PENDING_MS = 45_000;

/** Payout drains hit Bridge on every backend request — poll conservatively. */
export const BRIDGE_POLL_PAYOUT_PENDING_MS = 60_000;

/** Backend default idle deposit sync: 2m */
export const BRIDGE_POLL_IDLE_MS = 180_000;

/** Min gap between focus-triggered refresh() calls (force=true bypasses backend cache). */
export const BRIDGE_FOCUS_REFRESH_MS = BRIDGE_POLL_IDLE_MS;

export interface BridgePollMeta {
  hasPendingFundsReceived?: boolean;
  hasPendingPayoutDrains?: boolean;
}

export function resolveBridgePollIntervalMs(meta: BridgePollMeta): number {
  if (meta.hasPendingPayoutDrains) return BRIDGE_POLL_PAYOUT_PENDING_MS;
  if (meta.hasPendingFundsReceived) return BRIDGE_POLL_DEPOSIT_PENDING_MS;
  return BRIDGE_POLL_IDLE_MS;
}
