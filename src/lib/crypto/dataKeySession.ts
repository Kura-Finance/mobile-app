/**
 * TrackFi Data Key Session
 *
 * Keeps the DEK (Data Encryption Key) in memory for the duration of a TrackFi
 * session.  The key is never written to disk — it lives only in this module's
 * closure and is cleared:
 *   - After SESSION_TTL_MS of inactivity (auto-lock)
 *   - Explicitly via clearDataKey()
 *   - On app logout
 *
 * The DEK is a 32-byte AES-256-GCM key.  It is retrieved from the backend
 * after a successful Passkey authentication and used client-side to decrypt
 * TrackFi financial data (Plaid, broker snapshots).
 *
 * Security note: the key lives in JS heap and can be observed by other JS code.
 * For higher assurance, upgrade to a native secure-memory module.
 */

/** 10 minutes inactivity auto-lock. */
const SESSION_TTL_MS = 10 * 60 * 1_000;

let _dek: Uint8Array | null = null;
let _sessionTimer: ReturnType<typeof setTimeout> | null = null;
let _lastActivity = 0;

function resetTimer(): void {
  if (_sessionTimer !== null) {
    clearTimeout(_sessionTimer);
  }
  _lastActivity = Date.now();
  _sessionTimer = setTimeout(() => {
    clearDataKey();
  }, SESSION_TTL_MS);
}

/** Store the DEK in memory and start the inactivity timer. */
export function setDataKey(key: Uint8Array): void {
  if (key.length !== 32) {
    throw new Error(`DEK must be 32 bytes (got ${key.length})`);
  }
  // Zero out any existing key before overwriting
  _dek?.fill(0);
  _dek = new Uint8Array(key); // defensive copy
  resetTimer();
}

/**
 * Retrieve the current in-memory DEK and refresh the inactivity timer.
 * Returns null if no key is loaded or the session has expired.
 */
export function getDataKey(): Uint8Array | null {
  if (!_dek) return null;
  if (Date.now() - _lastActivity > SESSION_TTL_MS) {
    clearDataKey();
    return null;
  }
  resetTimer(); // refresh on access
  return _dek;
}

/** True if a DEK is currently loaded (session is open). */
export function isDataKeyLoaded(): boolean {
  return getDataKey() !== null;
}

/**
 * Zero out and remove the in-memory DEK.
 * Call this on logout, timeout, or explicit lock.
 */
export function clearDataKey(): void {
  _dek?.fill(0);
  _dek = null;
  if (_sessionTimer !== null) {
    clearTimeout(_sessionTimer);
    _sessionTimer = null;
  }
  _lastActivity = 0;
}

/**
 * Remaining session time in milliseconds.
 * Returns 0 if no session is active.
 */
export function dataKeyTtlMs(): number {
  if (!_dek) return 0;
  const elapsed = Date.now() - _lastActivity;
  return Math.max(0, SESSION_TTL_MS - elapsed);
}
