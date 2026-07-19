import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@kura/pinRateLimit';
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

let failedAttempts = 0;
let lockedUntil = 0;

interface PersistedRateLimit {
  failedAttempts: number;
  lockedUntil: number;
}

void AsyncStorage.getItem(STORAGE_KEY)
  .then((raw) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as PersistedRateLimit;
      failedAttempts = parsed.failedAttempts ?? 0;
      lockedUntil = parsed.lockedUntil ?? 0;
    } catch {
      // ignore corrupt state
    }
  })
  .catch(() => {});

function persist(): void {
  void AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ failedAttempts, lockedUntil } satisfies PersistedRateLimit),
  ).catch(() => {});
}

export function isPinLockedOut(): boolean {
  if (lockedUntil === 0) return false;
  if (Date.now() >= lockedUntil) {
    lockedUntil = 0;
    failedAttempts = 0;
    persist();
    return false;
  }
  return true;
}

export function recordPinFailure(): void {
  failedAttempts += 1;
  if (failedAttempts >= MAX_ATTEMPTS) {
    lockedUntil = Date.now() + LOCKOUT_MS;
    failedAttempts = 0;
  }
  persist();
}

export function resetPinAttempts(): void {
  failedAttempts = 0;
  lockedUntil = 0;
  persist();
}

/** Test hook. */
export function __resetPinRateLimitForTesting(): void {
  resetPinAttempts();
}
