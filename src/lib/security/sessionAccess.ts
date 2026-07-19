import { useAppStore } from '../../shared/store/useAppStore';
import { resolveUsableAuthToken } from './sessionAccessCore';

export type { SessionAccessState } from './sessionAccessCore';
export { resolveUsableAuthToken } from './sessionAccessCore';

/** JWT is only usable when the session is unlocked (not background-locked or checking). */
export function getUsableAuthToken(): string | null {
  return resolveUsableAuthToken(useAppStore.getState());
}

export function isSessionUsable(): boolean {
  return resolveUsableAuthToken(useAppStore.getState()) != null;
}

/** React hook — true only when session is fully unlocked with a token. */
export function useSessionUsable(): boolean {
  return useAppStore((s) => s.sessionLockStatus === 'unlocked' && s.authToken != null);
}
