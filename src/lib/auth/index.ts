/** Auth helpers — Privy bridge, passkeys, OAuth profile sync. */
export { applyPendingOAuthDisplayName } from './applyPendingOAuthName';
export {
  consumePendingAppleDisplayName,
  extractGoogleDisplayName,
  formatAppleFullName,
  profileNeedsDisplayName,
  setPendingAppleDisplayName,
  splitDisplayName,
  syncOAuthDisplayNameIfNeeded,
} from './oauthDisplayName';
