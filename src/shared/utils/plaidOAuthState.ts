/**
 * Global flag tracking whether a Plaid Link OAuth handoff is currently in flight.
 *
 * When a bank requires OAuth, Plaid presents a native ASWebAuthenticationSession
 * and the app is sent to the background. Anything that reacts to AppState changes
 * (session cleanup, on-foreground data refreshes, etc.) must treat that window as
 * "do not disturb" — tearing down the Plaid session or re-rendering the modal's
 * host mid-handoff aborts OAuth, so the redirect returns to nothing and
 * onSuccess never fires.
 *
 * This lives outside React so both the modal and AppState listeners can read it
 * synchronously regardless of mount state.
 */
// Safety cap: if a terminal Plaid result never arrives (e.g. the native UI is
// torn down by a crash before onSuccess/onExit fire), the flag auto-expires so
// it can't permanently disable AppState-driven refreshes/session cleanup.
const OAUTH_MAX_DURATION_MS = 6 * 60 * 1000;

let oauthStartedAt: number | null = null;

export function setPlaidOAuthInProgress(value: boolean): void {
  oauthStartedAt = value ? Date.now() : null;
}

export function isPlaidOAuthInProgress(): boolean {
  if (oauthStartedAt === null) return false;
  if (Date.now() - oauthStartedAt > OAUTH_MAX_DURATION_MS) {
    oauthStartedAt = null;
    return false;
  }
  return true;
}
