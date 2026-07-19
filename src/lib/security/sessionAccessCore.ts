export type SessionAccessState = {
  authToken: string | null;
  sessionLockStatus: 'checking' | 'locked' | 'unlocked';
};

/** Pure helper — testable without the Zustand store. */
export function resolveUsableAuthToken(state: SessionAccessState): string | null {
  if (state.sessionLockStatus !== 'unlocked') return null;
  return state.authToken;
}
