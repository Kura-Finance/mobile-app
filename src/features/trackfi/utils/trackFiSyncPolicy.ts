import { TRACKFI_AUTO_SYNC_INTERVAL_MS } from '../config/trackFiSync';

export type TrackFiSyncKind = 'plaid' | 'assetHistory' | 'exchange';

const globalLastSync: Partial<Record<TrackFiSyncKind, number>> = {};
const keyedLastSync: Partial<Record<TrackFiSyncKind, Record<string, number>>> = {};

function getLastSync(kind: TrackFiSyncKind, key?: string): number | null {
  if (key) {
    return keyedLastSync[kind]?.[key] ?? null;
  }
  return globalLastSync[kind] ?? null;
}

export function shouldAutoSyncTrackFi(
  kind: TrackFiSyncKind,
  opts?: { key?: string; force?: boolean },
): boolean {
  if (opts?.force) return true;
  const last = getLastSync(kind, opts?.key);
  if (last == null) return true;
  return Date.now() - last >= TRACKFI_AUTO_SYNC_INTERVAL_MS;
}

export function markTrackFiSynced(kind: TrackFiSyncKind, key?: string): void {
  const now = Date.now();
  if (key) {
    keyedLastSync[kind] = { ...keyedLastSync[kind], [key]: now };
    return;
  }
  globalLastSync[kind] = now;
}

/** Clear throttle state on logout / account teardown. */
export function resetTrackFiSyncPolicy(): void {
  for (const kind of Object.keys(globalLastSync) as TrackFiSyncKind[]) {
    delete globalLastSync[kind];
  }
  for (const kind of Object.keys(keyedLastSync) as TrackFiSyncKind[]) {
    delete keyedLastSync[kind];
  }
}
