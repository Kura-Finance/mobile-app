import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SessionTypes } from '@walletconnect/types';

const STORAGE_KEY_PREFIX = 'kura_wc_dapp_sessions_v1';
/** Legacy device-wide key — cleared on logout for migration. */
const LEGACY_STORAGE_KEY = STORAGE_KEY_PREFIX;

export type DappSessionStatus = 'active' | 'disconnected';

export interface DappSessionRecord {
  /** Stable key — peer URL when available, otherwise WC topic. */
  id: string;
  /** Present while the WalletConnect session is live. */
  topic?: string;
  name: string;
  url: string;
  icon?: string;
  connectedAt: number;
  disconnectedAt?: number;
  lastSeenAt: number;
  status: DappSessionStatus;
}

export function dappSessionStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}:${userId}`;
}

function recordIdFromSession(session: SessionTypes.Struct): string {
  const url = session.peer.metadata.url?.trim().toLowerCase();
  if (url) return url;
  return session.topic;
}

export function recordFromActiveSession(
  session: SessionTypes.Struct,
  existing?: DappSessionRecord,
): DappSessionRecord {
  const now = Date.now();
  const id = recordIdFromSession(session);
  return {
    id,
    topic: session.topic,
    name: session.peer.metadata.name ?? 'Unknown dApp',
    url: session.peer.metadata.url ?? '',
    icon: session.peer.metadata.icons?.[0],
    connectedAt: existing?.connectedAt ?? now,
    disconnectedAt: undefined,
    lastSeenAt: now,
    status: 'active',
  };
}

export function syncDappSessionHistory(
  activeSessions: SessionTypes.Struct[],
  previous: DappSessionRecord[],
): DappSessionRecord[] {
  const now = Date.now();
  const prevById = new Map(previous.map((r) => [r.id, r]));
  const activeIds = new Set<string>();

  const next: DappSessionRecord[] = activeSessions.map((session) => {
    const id = recordIdFromSession(session);
    activeIds.add(id);
    return recordFromActiveSession(session, prevById.get(id));
  });

  for (const record of previous) {
    if (activeIds.has(record.id)) continue;
    next.push({
      ...record,
      topic: undefined,
      status: 'disconnected',
      disconnectedAt: record.disconnectedAt ?? now,
      lastSeenAt: record.lastSeenAt,
    });
  }

  next.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return b.lastSeenAt - a.lastSeenAt;
  });

  return next;
}

export async function loadDappSessionHistory(userId: string): Promise<DappSessionRecord[]> {
  if (!userId) return [];
  try {
    const raw = await AsyncStorage.getItem(dappSessionStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DappSessionRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveDappSessionHistory(
  userId: string,
  records: DappSessionRecord[],
): Promise<void> {
  if (!userId) return;
  await AsyncStorage.setItem(dappSessionStorageKey(userId), JSON.stringify(records));
}

export async function removeDappSessionHistoryEntry(
  userId: string,
  id: string,
): Promise<DappSessionRecord[]> {
  const records = await loadDappSessionHistory(userId);
  const next = records.filter((r) => r.id !== id);
  await saveDappSessionHistory(userId, next);
  return next;
}

export async function clearDisconnectedDappHistory(userId: string): Promise<DappSessionRecord[]> {
  const records = await loadDappSessionHistory(userId);
  const next = records.filter((r) => r.status === 'active');
  await saveDappSessionHistory(userId, next);
  return next;
}

export async function clearDappSessionHistory(userId?: string): Promise<void> {
  const keys = new Set<string>([LEGACY_STORAGE_KEY]);
  if (userId) keys.add(dappSessionStorageKey(userId));
  await Promise.all([...keys].map((key) => AsyncStorage.removeItem(key)));
}
